import { createHash, randomBytes } from "node:crypto";

import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { z } from "zod";

import { jsonResponse } from "../../../../../api/security.mjs";
import { invitations } from "../../../../../db/schema.js";
import { appendAuditEvent } from "../../../../../src/server/audit.js";
import { HttpError } from "../../../../../src/server/errors.js";
import {
  databaseRoute,
  parseJsonBody,
  requireAuthenticatedUser,
  requireSameOriginMutation,
} from "../../../../../src/server/http.js";
import { normalizeEmail } from "../../../../../src/server/auth/passwords.js";
import { requireWorkspaceCapability } from "../../../../../src/server/rbac.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const requestSchema = z.object({
  email: z.string().trim().email().max(254),
  role: z.enum(["admin", "contributor", "reviewer", "viewer"]),
});

function invitationUrl(request, token) {
  const requestOrigin = new URL(request.url).origin;
  const configured = process.env.APP_ORIGIN;
  const origin = configured || requestOrigin;
  if (process.env.NODE_ENV === "production" && !configured) {
    throw new HttpError(
      503,
      "Invitation links require APP_ORIGIN configuration.",
      "app_origin_missing",
    );
  }
  const url = new URL("/", origin);
  url.searchParams.set("invite", token);
  return url.toString();
}

export async function GET(request, context) {
  return databaseRoute(async ({ db }) => {
    const actor = await requireAuthenticatedUser(db, request);
    const { workspaceId } = await context.params;
    await requireWorkspaceCapability(db, {
      workspaceId,
      userId: actor.userId,
      capability: "manage_members",
    });
    const rows = await db
      .select({
        id: invitations.id,
        email: invitations.email,
        role: invitations.role,
        expiresAt: invitations.expiresAt,
        acceptedAt: invitations.acceptedAt,
        revokedAt: invitations.revokedAt,
        createdAt: invitations.createdAt,
      })
      .from(invitations)
      .where(eq(invitations.workspaceId, workspaceId))
      .orderBy(invitations.createdAt);
    return jsonResponse({ invitations: rows });
  });
}

export async function POST(request, context) {
  return databaseRoute(async ({ db }) => {
    requireSameOriginMutation(request, "workspace-invitation");
    const actor = await requireAuthenticatedUser(db, request);
    const { workspaceId } = await context.params;
    const actorMembership = await requireWorkspaceCapability(db, {
      workspaceId,
      userId: actor.userId,
      capability: "manage_members",
    });
    const input = await parseJsonBody(request, requestSchema, 4_096);
    const email = normalizeEmail(input.email);

    const [active] = await db
      .select({ id: invitations.id })
      .from(invitations)
      .where(
        and(
          eq(invitations.workspaceId, workspaceId),
          sql`lower(${invitations.email}) = ${email}`,
          isNull(invitations.acceptedAt),
          isNull(invitations.revokedAt),
          gt(invitations.expiresAt, new Date()),
        ),
      )
      .limit(1);
    if (active) {
      throw new HttpError(
        409,
        "An active invitation already exists for this email.",
        "invitation_exists",
      );
    }

    const token = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const invitation = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(invitations)
        .values({
          workspaceId,
          email,
          role: input.role,
          tokenHash,
          invitedBy: actor.userId,
          expiresAt,
        })
        .returning({
          id: invitations.id,
          email: invitations.email,
          role: invitations.role,
          expiresAt: invitations.expiresAt,
        });
      await appendAuditEvent(tx, {
        workspaceId,
        actorId: actor.userId,
        actorRole: actorMembership.role,
        action: "invitation.created",
        targetType: "invitation",
        targetId: created.id,
        metadata: { email, role: input.role, expiresAt: expiresAt.toISOString() },
      });
      return created;
    });

    return jsonResponse(
      {
        invitation,
        inviteUrl: invitationUrl(request, token),
      },
      { status: 201 },
    );
  });
}

