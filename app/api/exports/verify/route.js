import { createPublicKey } from "node:crypto";

import { consumeRateLimit, jsonResponse, readBoundedText } from "../../../../api/security.mjs";
import {
  exportSigningConfig,
  verifyExportEnvelope,
} from "../../../../src/server/signed-export.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request) {
  const rate = consumeRateLimit(request, {
    bucket: "export-verify",
    limit: 60,
    windowMs: 10 * 60 * 1000,
  });
  if (!rate.allowed) {
    return jsonResponse(
      { error: "Too many verification requests.", code: "rate_limited" },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSeconds) },
      },
    );
  }
  try {
    const envelope = JSON.parse(await readBoundedText(request, 512_000));
    const config = exportSigningConfig();
    const result = verifyExportEnvelope(
      envelope,
      createPublicKey(config.publicKeyPem),
    );
    return jsonResponse({ ...result, publicKeyId: config.keyId });
  } catch (error) {
    const unavailable = error?.code === "export_signing_unavailable";
    return jsonResponse(
      {
        valid: false,
        reason: unavailable ? "verification_unavailable" : "invalid_envelope",
      },
      { status: unavailable ? 503 : 400 },
    );
  }
}
