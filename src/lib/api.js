export const markers = {
  login: "auth-login",
  register: "auth-register",
  logout: "auth-logout",
  workspace: "workspace-create",
  project: "project-create",
  release: "release-create",
  claim: "claim-create",
  evidence: "evidence-create",
  decision: "decision-create",
  verdict: "verdict-run",
  export: "export-generate",
  invite: "workspace-invitation",
  invitationAccept: "invitation-accept",
  demo: "demo-session",
  releaseUpdate: "release-update",
  githubConnect: "github-connect",
  githubLink: "github-repository-link",
  githubImport: "github-import",
};

export async function api(path, options = {}) {
  const headers = new Headers(options.headers);
  if (options.body !== undefined) headers.set("content-type", "application/json");
  if (options.marker) headers.set("x-release-truth-request", options.marker);
  let response;
  try {
    response = await fetch(path, {
      method: options.method || "GET",
      credentials: "same-origin",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      cache: "no-store",
      signal: options.signal || AbortSignal.timeout(options.timeoutMs || 20_000),
    });
  } catch {
    const error = new Error("The server did not respond. Retry in a moment.");
    error.code = "network_unreachable";
    throw error;
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || "The request could not be completed.");
    error.code = payload.code;
    error.status = response.status;
    throw error;
  }
  return payload;
}
