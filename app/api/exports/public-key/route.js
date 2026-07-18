import { jsonResponse } from "../../../../api/security.mjs";
import { exportSigningConfig } from "../../../../src/server/signed-export.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const config = exportSigningConfig();
    return jsonResponse({
      algorithm: "Ed25519",
      publicKeyId: config.keyId,
      publicKeyPem: config.publicKeyPem,
    });
  } catch {
    return jsonResponse(
      {
        error: "Export verification key is not configured.",
        code: "export_signing_unavailable",
      },
      { status: 503 },
    );
  }
}
