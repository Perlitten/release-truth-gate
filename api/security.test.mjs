import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  authenticateAccessCode,
  consumeRateLimit,
  getAnalystAccessState,
  readBoundedText,
  sessionCookieHeader,
  validateSameOrigin,
} from "./security.mjs";

beforeEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

function configureProductionAccess(appOrigin = "https://release.example") {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("APP_ORIGIN", appOrigin);
  vi.stubEnv("RELEASE_TRUTH_ACCESS_CODE", "test-access");
  vi.stubEnv(
    "RELEASE_TRUTH_SESSION_SECRET",
    "release-truth-test-session-secret-with-sufficient-length",
  );
}

function cookiePairFor(token) {
  return sessionCookieHeader(token).split(";")[0];
}

describe("same-origin guard", () => {
  it("accepts the configured application origin", () => {
    vi.stubEnv("APP_ORIGIN", "https://release.example");
    const request = new Request("https://release.example/api/analyze", {
      method: "POST",
      headers: {
        Origin: "https://release.example",
        "Sec-Fetch-Site": "same-origin",
      },
    });
    expect(validateSameOrigin(request)).toBe(true);
  });

  it("uses the configured public origin behind a trusted reverse proxy", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_ORIGIN", "https://release.example");
    const request = new Request("https://0.0.0.0:3000/api/analyze", {
      method: "POST",
      headers: {
        Origin: "https://release.example",
        "Sec-Fetch-Site": "same-origin",
      },
    });
    expect(validateSameOrigin(request)).toBe(true);
  });

  it("rejects missing and cross-site origins", () => {
    expect(
      validateSameOrigin(
        new Request("https://release.example/api/analyze", { method: "POST" }),
      ),
    ).toBe(false);
    expect(
      validateSameOrigin(
        new Request("https://release.example/api/analyze", {
          method: "POST",
          headers: {
            Origin: "https://evil.example",
            "Sec-Fetch-Site": "cross-site",
          },
        }),
      ),
    ).toBe(false);
  });

  it("accepts localhost aliases only outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(
      validateSameOrigin(
        new Request("http://localhost:3000/api/analyze", {
          method: "POST",
          headers: {
            Origin: "http://127.0.0.1:3000",
            "Sec-Fetch-Site": "same-origin",
          },
        }),
      ),
    ).toBe(true);
  });
});

describe("resource guards", () => {
  it("stops reading a streamed body once the byte limit is exceeded", async () => {
    const request = new Request("https://release.example/api/analyze", {
      method: "POST",
      body: "a".repeat(101),
      duplex: "half",
    });
    await expect(readBoundedText(request, 100)).rejects.toMatchObject({
      code: "BODY_TOO_LARGE",
    });
  });

  it("applies an app-level request window", () => {
    const request = new Request("http://localhost/api/analyze");
    expect(
      consumeRateLimit(request, {
        bucket: `test-${crypto.randomUUID()}`,
        limit: 1,
      }).allowed,
    ).toBe(true);
    const bucket = `test-${crypto.randomUUID()}`;
    consumeRateLimit(request, { bucket, limit: 1 });
    expect(consumeRateLimit(request, { bucket, limit: 1 }).allowed).toBe(false);
  });

  it("does not collapse every unidentified production client into one bucket", () => {
    vi.stubEnv("NODE_ENV", "production");
    const bucket = `fingerprint-${crypto.randomUUID()}`;
    const firstClient = new Request("https://release.example/api/session", {
      headers: { "User-Agent": "client-a", "Accept-Language": "en" },
    });
    const secondClient = new Request("https://release.example/api/session", {
      headers: { "User-Agent": "client-b", "Accept-Language": "en" },
    });

    expect(consumeRateLimit(firstClient, { bucket, limit: 1 }).allowed).toBe(true);
    expect(consumeRateLimit(firstClient, { bucket, limit: 1 }).allowed).toBe(false);
    expect(consumeRateLimit(secondClient, { bucket, limit: 1 }).allowed).toBe(true);
  });
});

describe("production access configuration", () => {
  it("allows an exact loopback origin for the production Worker preview", () => {
    configureProductionAccess("http://127.0.0.1:8787");

    const state = getAnalystAccessState(
      new Request("http://127.0.0.1:8787/api/session"),
    );
    expect(state).toMatchObject({
      enabled: true,
      required: true,
      authenticated: false,
    });
    const result = authenticateAccessCode("test-access");
    expect(sessionCookieHeader(result.token)).toMatch(
      /^release_truth_session=.*; HttpOnly; SameSite=Strict$/,
    );
  });

  it("rejects a non-TLS non-loopback production origin", () => {
    configureProductionAccess("http://release.example");

    const state = getAnalystAccessState(
      new Request("http://release.example/api/session"),
    );
    expect(state.enabled).toBe(false);
  });

  it("issues a secure __Host cookie and accepts the valid session", () => {
    configureProductionAccess();
    const result = authenticateAccessCode("test-access");

    expect(result).toMatchObject({ ok: true, actor: "Authenticated reviewer" });
    expect(sessionCookieHeader(result.token)).toMatch(
      /^__Host-release_truth_session=.*; HttpOnly; SameSite=Strict; Secure$/,
    );
    expect(
      getAnalystAccessState(
        new Request("https://release.example/api/session", {
          headers: { Cookie: cookiePairFor(result.token) },
        }),
      ).authenticated,
    ).toBe(true);
  });

  it("rejects invalid access codes and tampered session tokens", () => {
    configureProductionAccess();
    expect(authenticateAccessCode("wrong-access")).toMatchObject({
      ok: false,
      reason: "invalid",
    });

    const result = authenticateAccessCode("test-access");
    const parts = result.token.split(".");
    const replacement = parts[2].endsWith("A") ? "B" : "A";
    parts[2] = `${parts[2].slice(0, -1)}${replacement}`;
    const tamperedCookie = cookiePairFor(parts.join("."));

    expect(
      getAnalystAccessState(
        new Request("https://release.example/api/session", {
          headers: { Cookie: tamperedCookie },
        }),
      ).authenticated,
    ).toBe(false);
  });

  it("rejects expired session tokens", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-18T10:00:00Z"));
    configureProductionAccess();
    const result = authenticateAccessCode("test-access");
    const cookie = cookiePairFor(result.token);
    vi.advanceTimersByTime((8 * 60 * 60 + 1) * 1_000);

    expect(
      getAnalystAccessState(
        new Request("https://release.example/api/session", {
          headers: { Cookie: cookie },
        }),
      ).authenticated,
    ).toBe(false);
  });
});
