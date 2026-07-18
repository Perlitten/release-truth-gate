import { createHmac, timingSafeEqual } from "node:crypto";

import { eq } from "drizzle-orm";

import { jsonResponse, readBoundedText } from "../../../../api/security.mjs";
import { githubInstallations } from "../../../../db/schema.js";
import { appendAuditEvent } from "../../../../src/server/audit.js";
import { databaseRoute } from "../../../../src/server/http.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function signatureValid(body, supplied, secret) {
  const expected = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
  const left = Buffer.from(expected);
  const right = Buffer.from(supplied || "");
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function POST(request) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) {
    return jsonResponse(
      { error: "GitHub webhooks are not configured.", code: "github_app_unavailable" },
      { status: 503 },
    );
  }
  let body;
  try {
    body = await readBoundedText(request, 1_000_000);
  } catch {
    return jsonResponse({ error: "Webhook payload is too large." }, { status: 413 });
  }
  if (!signatureValid(body, request.headers.get("x-hub-signature-256"), secret)) {
    return jsonResponse({ error: "Webhook signature is invalid." }, { status: 401 });
  }
  const event = request.headers.get("x-github-event");
  if (event !== "installation") return jsonResponse({ accepted: true });
  let payload;
  try {
    payload = JSON.parse(body);
  } catch {
    return jsonResponse({ error: "Webhook JSON is invalid." }, { status: 400 });
  }
  const installationId = String(payload.installation?.id || "");
  if (!installationId) {
    return jsonResponse({ error: "Installation id is missing." }, { status: 400 });
  }
  return databaseRoute(async ({ db }) => {
    const [installation] = await db
      .select()
      .from(githubInstallations)
      .where(eq(githubInstallations.installationId, installationId))
      .limit(1);
    if (!installation) return jsonResponse({ accepted: true, tracked: false });
    const action = payload.action;
    const updates =
      action === "deleted"
        ? { status: "deleted", deletedAt: new Date(), updatedAt: new Date() }
        : action === "suspend"
          ? { status: "suspended", suspendedAt: new Date(), updatedAt: new Date() }
          : action === "unsuspend" || action === "new_permissions_accepted"
            ? {
                status: "active",
                suspendedAt: null,
                repositorySelection:
                  payload.installation.repository_selection ||
                  installation.repositorySelection,
                updatedAt: new Date(),
              }
            : payload.installation.repository_selection
              ? {
                  repositorySelection: payload.installation.repository_selection,
                  updatedAt: new Date(),
                }
              : null;
    if (!updates) return jsonResponse({ accepted: true, tracked: true });
    await db.transaction(async (tx) => {
      await tx
        .update(githubInstallations)
        .set(updates)
        .where(eq(githubInstallations.id, installation.id));
      await appendAuditEvent(tx, {
        workspaceId: installation.workspaceId,
        action: `github.installation_${action}`,
        targetType: "github_installation",
        targetId: installation.id,
        metadata: {
          installationId,
          deliveryId: request.headers.get("x-github-delivery"),
        },
      });
    });
    return jsonResponse({ accepted: true, tracked: true });
  });
}
