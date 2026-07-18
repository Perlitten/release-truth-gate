import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route.js";

function configureProductionAccess() {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("APP_ORIGIN", "https://release.example");
  vi.stubEnv("RELEASE_TRUTH_ACCESS_CODE", "test-access");
  vi.stubEnv(
    "RELEASE_TRUTH_SESSION_SECRET",
    "release-truth-test-session-secret-with-sufficient-length",
  );
}

function sessionRequest(accessCode, headers = {}) {
  return new Request("https://release.example/api/session", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://release.example",
      "Sec-Fetch-Site": "same-origin",
      "X-Release-Truth-Request": "session",
      "CF-Connecting-IP": crypto.randomUUID(),
      ...headers,
    },
    body: JSON.stringify({ accessCode }),
  });
}

beforeEach(() => {
  vi.unstubAllEnvs();
  configureProductionAccess();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("/api/session", () => {
  it("issues a signed cookie that authenticates the subsequent GET", async () => {
    const response = await POST(sessionRequest("test-access"));
    const setCookie = response.headers.get("set-cookie");

    expect(response.status).toBe(200);
    expect(setCookie).toMatch(
      /^__Host-release_truth_session=.*; HttpOnly; SameSite=Strict; Secure$/,
    );

    const cookie = setCookie.split(";")[0];
    const authenticated = GET(
      new Request("https://release.example/api/session", {
        headers: { Cookie: cookie },
      }),
    );
    await expect(authenticated.json()).resolves.toMatchObject({
      enabled: true,
      required: true,
      authenticated: true,
      actor: "Authenticated reviewer",
    });
  });

  it("rejects an invalid access code without issuing a cookie", async () => {
    const response = await POST(sessionRequest("wrong-access"));

    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie")).toBeNull();
    await expect(response.json()).resolves.toEqual({
      error: "The access code is invalid.",
    });
  });

  it("rejects cross-site requests before checking credentials", async () => {
    const response = await POST(
      sessionRequest("test-access", {
        Origin: "https://evil.example",
        "Sec-Fetch-Site": "cross-site",
      }),
    );

    expect(response.status).toBe(403);
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});
