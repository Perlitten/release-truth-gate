import { generateKeyPairSync } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  createGitHubAppJwt,
  createGitHubState,
  hashGitHubState,
} from "./github-app.js";

describe("GitHub App authentication primitives", () => {
  it("creates an RS256 app JWT without exposing the private key", () => {
    const { privateKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
    });
    const token = createGitHubAppJwt(
      {
        appId: "12345",
        privateKey: privateKey.export({ format: "pem", type: "pkcs8" }),
      },
      Date.parse("2026-07-18T12:00:00Z"),
    );
    const [header, payload, signature] = token.split(".");
    expect(JSON.parse(Buffer.from(header, "base64url"))).toEqual({
      alg: "RS256",
      typ: "JWT",
    });
    expect(JSON.parse(Buffer.from(payload, "base64url")).iss).toBe("12345");
    expect(signature.length).toBeGreaterThan(100);
  });

  it("stores only a SHA-256 digest of the OAuth state", () => {
    const generated = createGitHubState();
    expect(generated.state).not.toBe(generated.stateHash);
    expect(generated.stateHash).toBe(hashGitHubState(generated.state));
    expect(generated.stateHash).toHaveLength(64);
  });
});
