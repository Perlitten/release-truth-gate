import { and, count, eq } from "drizzle-orm";
import { z } from "zod";

import { jsonResponse } from "../../../../../../api/security.mjs";
import { memberships } from "../../../../../../db/schema.js";
import { appendAuditEvent } from "../../../../../../src/server/audit.js";
import { HttpError } from "../../../../../../src/server/errors.js";
import {
  databaseRoute,
  parseJsonBody,
  requireAuthenticatedUser,
  requireSameOriginMutation,
} from "../../../../../../src/server/http.js";
import { requireWorkspaceCapability } from "../../../../../../src/server/rbac.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const requestSchema = z.object({
  role: z.enum(["owner", "admin", "contributor", "reviewer", "viewer"]),
});

export async function PATCH(request, context) {
  return databaseRoute(async ({ db }) => {
    requireSameOriginMutation(request, "membership-role");
    const actor = await requireAuthenticatedUser(db, request);
    const { workspaceId, userId } = await context.params;
    const actorMembership = await requireWorkspaceCapability(db, {
      workspaceId,
      userId: actor.userId,
      capability: "manage_members",
    });
    const input = await parseJsonBody(request, requestSchema, 2_048);

    const membership = await db.transaction(async (tx) => {
      const [target] = await tx
        .select()
        .from(memberships)
        .where(
          and(
            eq(memberships.workspaceId, workspaceId),
            eq(memberships.userId, userId),
          ),
        )
        .for("update")
        .limit(1);
      if (!target) {
        throw new HttpError(404, "Membership not found.", "membership_not_found");
      }
      if (
        actorMembership.role === "admin" &&
        (target.role === "owner" || input.role === "owner")
      ) {
        throw new HttpError(
          403,
          "Admins cannot assign or change workspace ownership.",
          "owner_only",
        );
      }
      if (target.role === "owner" && input.role !== "owner") {
        const [owners] = await tx
          .select({ value: count() })
          .from(memberships)
          .where(
            and(
              eq(memberships.workspaceId, workspaceId),
              eq(memberships.role, "owner"),
            ),
          );
        if (Number(owners.value) <= 1) {
          throw new HttpError(
            409,
            "The workspace must retain at least one owner.",
            "last_owner",
          );
        }
      }

      const [updated] = await tx
        .update(memberships)
        .set({ role: input.role, updatedAt: new Date() })
        .where(
          and(
            eq(memberships.workspaceId, workspaceId),
            eq(memberships.userId, userId),
          ),
        )
        .returning();
      await appendAuditEvent(tx, {
        workspaceId,
        actorId: actor.userId,
        actorRole: actorMembership.role,
        action: "membership.role_changed",
        targetType: "user",
        targetId: userId,
        metadata: { previousRole: target.role, role: input.role },
      });
      return updated;
    });

    return jsonResponse({ membership });
  });
}

