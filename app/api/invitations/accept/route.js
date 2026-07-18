import { createHash } from "node:crypto";

import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { jsonResponse } from "../../../../api/security.mjs";
import {
  invitations,
  memberships,
} from "../../../../db/schema.js";
import { appendAuditEvent } from "../../../../src/server/audit.js";
import { normalizeEmail } from "../../../../src/server/auth/passwords.js";
import { HttpError } from "../../../../src/server/errors.js";
import {
  databaseRoute,
  parseJsonBody,
  requireAuthenticatedUser,
  requireSameOriginMutation,
} from "../../../../src/server/http.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const requestSchema = z.object({
  token: z.string().min(32).max(160),
});

export async function POST(request) {
  return databaseRoute(async ({ db }) => {
    requireSameOriginMutation(request, "invitation-accept");
    const user = await requireAuthenticatedUser(db, request);
    const input = await parseJsonBody(request, requestSchema, 2_048);
    const tokenHash = createHash("sha256").update(input.token).digest("hex");

    const membership = await db.transaction(async (tx) => {
      const [invitation] = await tx
        .select()
        .from(invitations)
        .where(eq(invitations.tokenHash, tokenHash))
        .for("update")
        .limit(1);
      if (!invitation) {
        throw new HttpError(
          404,
          "Invitation not found.",
          "invitation_not_found",
        );
      }
      if (
        invitation.acceptedAt ||
        invitation.revokedAt ||
        invitation.expiresAt <= new Date()
      ) {
        throw new HttpError(
          410,
          "This invitation is no longer valid.",
          "invitation_expired",
        );
      }
      if (normalizeEmail(invitation.email) !== normalizeEmail(user.email)) {
        throw new HttpError(
          403,
          "This invitation belongs to a different email address.",
          "invitation_email_mismatch",
        );
      }

      const [existing] = await tx
        .select({ role: memberships.role })
        .from(memberships)
        .where(
          and(
            eq(memberships.workspaceId, invitation.workspaceId),
            eq(memberships.userId, user.userId),
          ),
        )
        .limit(1);
      if (existing) {
        throw new HttpError(
          409,
          "This user is already a workspace member.",
          "membership_exists",
        );
      }

      const [created] = await tx
        .insert(memberships)
        .values({
          workspaceId: invitation.workspaceId,
          userId: user.userId,
          role: invitation.role,
          invitedBy: invitation.invitedBy,
        })
        .returning();
      await tx
        .update(invitations)
        .set({ acceptedAt: new Date(), acceptedBy: user.userId })
        .where(eq(invitations.id, invitation.id));
      await appendAuditEvent(tx, {
        workspaceId: invitation.workspaceId,
        actorId: user.userId,
        actorRole: invitation.role,
        action: "invitation.accepted",
        targetType: "invitation",
        targetId: invitation.id,
        metadata: { userId: user.userId, role: invitation.role },
      });
      return created;
    });

    return jsonResponse({ membership });
  });
}

