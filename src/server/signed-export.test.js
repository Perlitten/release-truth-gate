import { generateKeyPairSync } from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  EXPORT_FORMAT_VERSION,
  exportSigningConfig,
  signExportManifest,
  verifyExportEnvelope,
} from "./signed-export.js";

afterEach(() => vi.unstubAllEnvs());

describe("signed release exports", () => {
  it("verifies the canonical manifest and rejects a modified verdict", () => {
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    const manifest = {
      formatVersion: EXPORT_FORMAT_VERSION,
      release: { id: "release-1", name: "2.0.0" },
      verdictRun: { id: "run-1", result: { status: "go" } },
    };
    const signed = signExportManifest(manifest, {
      privateKey,
      publicKey,
      keyId: "test-key",
    });
    const envelope = {
      formatVersion: EXPORT_FORMAT_VERSION,
      manifest,
      ...signed,
    };

    expect(verifyExportEnvelope(envelope, publicKey)).toEqual({
      valid: true,
      reason: "signature_valid",
    });

    const modified = structuredClone(envelope);
    modified.manifest.verdictRun.result.status = "no_go";
    expect(verifyExportEnvelope(modified, publicKey)).toEqual({
      valid: false,
      reason: "artifact_hash_mismatch",
    });
  });

  it("loads PEM keys through base64-safe environment transport", () => {
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    vi.stubEnv(
      "EXPORT_SIGNING_PRIVATE_KEY_BASE64",
      Buffer.from(
        privateKey.export({ format: "pem", type: "pkcs8" }),
      ).toString("base64"),
    );
    vi.stubEnv(
      "EXPORT_SIGNING_PUBLIC_KEY_BASE64",
      Buffer.from(
        publicKey.export({ format: "pem", type: "spki" }),
      ).toString("base64"),
    );
    vi.stubEnv("EXPORT_SIGNING_KEY_ID", "base64-test-key");
    const config = exportSigningConfig();
    expect(config.privateKey.asymmetricKeyType).toBe("ed25519");
    expect(config.publicKey.asymmetricKeyType).toBe("ed25519");
    expect(config.keyId).toBe("base64-test-key");
  });
});
