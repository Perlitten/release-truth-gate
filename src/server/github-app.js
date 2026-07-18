import {
  createHash,
  createPrivateKey,
  createSign,
  randomBytes,
} from "node:crypto";

import { HttpError } from "./errors.js";

const GITHUB_API = "https://api.github.com";
const GITHUB_API_VERSION = "2026-03-10";

function required(name) {
  const value = process.env[name]?.replaceAll("\\n", "\n").trim();
  if (!value) {
    throw new HttpError(
      503,
      "GitHub App integration is not configured.",
      "github_app_unavailable",
    );
  }
  return value;
}

export function githubAppConfig() {
  return {
    appId: required("GITHUB_APP_ID"),
    slug: required("GITHUB_APP_SLUG"),
    clientId: required("GITHUB_APP_CLIENT_ID"),
    clientSecret: required("GITHUB_APP_CLIENT_SECRET"),
    privateKey: required("GITHUB_APP_PRIVATE_KEY"),
  };
}

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

export function createGitHubAppJwt(config = githubAppConfig(), now = Date.now()) {
  const issuedAt = Math.floor(now / 1000) - 60;
  const unsigned = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({
    iat: issuedAt,
    exp: issuedAt + 9 * 60,
    iss: config.appId,
  })}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const signature = signer
    .sign(createPrivateKey(config.privateKey))
    .toString("base64url");
  return `${unsigned}.${signature}`;
}

async function githubFetch(path, { token, method = "GET", body } = {}) {
  const response = await fetch(`${GITHUB_API}${path}`, {
    method,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "release-truth-evidence-gate",
      "X-GitHub-Api-Version": GITHUB_API_VERSION,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.warn(
      JSON.stringify({
        event: "release_truth_github_api_error",
        method,
        path,
        status: response.status,
        requestId: response.headers.get("x-github-request-id"),
      }),
    );
    throw new HttpError(
      response.status === 404 ? 404 : 502,
      response.status === 404
        ? "The requested GitHub resource was not found."
        : "GitHub could not complete the request.",
      response.status === 404 ? "github_resource_not_found" : "github_api_error",
    );
  }
  return payload;
}

export function createGitHubState() {
  const state = randomBytes(32).toString("base64url");
  return { state, stateHash: hashGitHubState(state) };
}

export function hashGitHubState(state) {
  return createHash("sha256").update(String(state)).digest("hex");
}

export function githubInstallUrl(state, config = githubAppConfig()) {
  const url = new URL(`https://github.com/apps/${config.slug}/installations/new`);
  url.searchParams.set("state", state);
  return url.toString();
}

export function githubAuthorizeUrl(state, config = githubAppConfig()) {
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeGitHubOAuthCode(code, config = githubAppConfig()) {
  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": "release-truth-evidence-gate",
    },
    body: JSON.stringify({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) {
    throw new HttpError(
      502,
      "GitHub authorization could not be completed.",
      "github_oauth_failed",
    );
  }
  return payload.access_token;
}

export async function getGitHubInstallation(installationId) {
  return githubFetch(`/app/installations/${encodeURIComponent(installationId)}`, {
    token: createGitHubAppJwt(),
  });
}

export async function listUserGitHubInstallations(userToken) {
  const payload = await githubFetch("/user/installations?per_page=100", {
    token: userToken,
  });
  return payload.installations || [];
}

export async function createInstallationToken(installationId) {
  const payload = await githubFetch(
    `/app/installations/${encodeURIComponent(installationId)}/access_tokens`,
    {
      token: createGitHubAppJwt(),
      method: "POST",
      body: {},
    },
  );
  return payload.token;
}

export async function listInstallationRepositories(installationId) {
  const token = await createInstallationToken(installationId);
  const payload = await githubFetch("/installation/repositories?per_page=100", {
    token,
  });
  return payload.repositories || [];
}

export async function getInstallationRepository(installationId, owner, name) {
  const repositories = await listInstallationRepositories(installationId);
  const repository = repositories.find(
    (item) =>
      item.owner?.login?.toLowerCase() === owner.toLowerCase() &&
      item.name?.toLowerCase() === name.toLowerCase(),
  );
  if (!repository) {
    throw new HttpError(
      404,
      "That repository is not accessible to this GitHub App installation.",
      "github_repository_not_accessible",
    );
  }
  return repository;
}

export async function fetchGitHubImportObject({
  installationId,
  owner,
  repository,
  objectType,
  reference,
}) {
  const token = await createInstallationToken(installationId);
  const root = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}`;
  const value = encodeURIComponent(reference);
  const paths = {
    issue: `${root}/issues/${value}`,
    pull_request: `${root}/pulls/${value}`,
    commit: `${root}/commits/${value}`,
    check_run: `${root}/check-runs/${value}`,
    status: `${root}/commits/${value}/status`,
  };
  return githubFetch(paths[objectType], { token });
}
