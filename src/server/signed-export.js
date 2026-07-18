import {
  createHash,
  createPrivateKey,
  createPublicKey,
  sign,
  verify,
} from "node:crypto";

import { canonicalJson } from "../lib/canonical-json.js";
import { HttpError } from "./errors.js";

export const EXPORT_FORMAT_VERSION = 1;
export const EXPORT_SIGNATURE_ALGORITHM = "Ed25519";

function readPem(name) {
  const value = process.env[name]?.replaceAll("\\n", "\n").trim();
  if (!value) {
    throw new HttpError(
      503,
      "Signed exports are not configured.",
      "export_signing_unavailable",
    );
  }
  return value;
}

export function exportSigningConfig() {
  const privateKey = createPrivateKey(readPem("EXPORT_SIGNING_PRIVATE_KEY"));
  if (privateKey.asymmetricKeyType !== "ed25519") {
    throw new HttpError(
      503,
      "The configured export key is not Ed25519.",
      "export_signing_unavailable",
    );
  }
  const publicKey = process.env.EXPORT_SIGNING_PUBLIC_KEY
    ? createPublicKey(readPem("EXPORT_SIGNING_PUBLIC_KEY"))
    : createPublicKey(privateKey);
  if (publicKey.asymmetricKeyType !== "ed25519") {
    throw new HttpError(
      503,
      "The configured export public key is not Ed25519.",
      "export_signing_unavailable",
    );
  }
  const publicKeyPem = publicKey.export({ format: "pem", type: "spki" });
  const derivedKeyId = createHash("sha256")
    .update(publicKeyPem)
    .digest("hex")
    .slice(0, 24);
  return {
    privateKey,
    publicKey,
    publicKeyPem,
    keyId: process.env.EXPORT_SIGNING_KEY_ID?.trim() || derivedKeyId,
  };
}

export function artifactHash(manifest) {
  return createHash("sha256").update(canonicalJson(manifest)).digest("hex");
}

export function signExportManifest(manifest, config = exportSigningConfig()) {
  const payload = Buffer.from(canonicalJson(manifest));
  return {
    artifactHash: artifactHash(manifest),
    signature: sign(null, payload, config.privateKey).toString("base64"),
    signatureAlgorithm: EXPORT_SIGNATURE_ALGORITHM,
    publicKeyId: config.keyId,
  };
}

export function verifyExportEnvelope(envelope, publicKey) {
  if (
    envelope?.formatVersion !== EXPORT_FORMAT_VERSION ||
    envelope?.signatureAlgorithm !== EXPORT_SIGNATURE_ALGORITHM ||
    typeof envelope?.artifactHash !== "string" ||
    typeof envelope?.signature !== "string" ||
    !envelope?.manifest
  ) {
    return { valid: false, reason: "invalid_envelope" };
  }
  const expectedHash = artifactHash(envelope.manifest);
  if (expectedHash !== envelope.artifactHash) {
    return { valid: false, reason: "artifact_hash_mismatch" };
  }
  try {
    const valid = verify(
      null,
      Buffer.from(canonicalJson(envelope.manifest)),
      publicKey,
      Buffer.from(envelope.signature, "base64"),
    );
    return {
      valid,
      reason: valid ? "signature_valid" : "signature_invalid",
    };
  } catch {
    return { valid: false, reason: "signature_invalid" };
  }
}
