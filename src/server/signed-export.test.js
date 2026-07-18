import { generateKeyPairSync } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  EXPORT_FORMAT_VERSION,
  signExportManifest,
  verifyExportEnvelope,
} from "./signed-export.js";

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
});
