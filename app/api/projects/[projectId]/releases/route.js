import { eq } from "drizzle-orm";
import { z } from "zod";

import { jsonResponse } from "../../../../../api/security.mjs";
import { releases } from "../../../../../db/schema.js";
import { appendAuditEvent } from "../../../../../src/server/audit.js";
import {
  databaseRoute,
  parseJsonBody,
  requireAuthenticatedUser,
  requireSameOriginMutation,
} from "../../../../../src/server/http.js";
import { requireProjectCapability } from "../../../../../src/server/rbac.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const releaseSchema = z
  .object({
    name: z.string().trim().min(1).max(160),
    description: z.string().trim().max(4_000).default(""),
    targetType: z
      .enum(["branch", "tag", "commit", "unspecified"])
      .default("unspecified"),
    targetValue: z.string().trim().max(255).nullable().optional(),
  })
  .superRefine((value, context) => {
    if (value.targetType === "unspecified" && value.targetValue) {
      context.addIssue({
        code: "custom",
        path: ["targetValue"],
        message: "Unspecified targets cannot have a value.",
      });
    }
    if (value.targetType !== "unspecified" && !value.targetValue) {
      context.addIssue({
        code: "custom",
        path: ["targetValue"],
        message: "A release target value is required.",
      });
    }
  });

export async function GET(request, { params }) {
  return databaseRoute(async ({ db }) => {
    const user = await requireAuthenticatedUser(db, request);
    const { projectId } = await params;
    const membership = await requireProjectCapability(db, {
      projectId,
      userId: user.userId,
      capability: "view",
    });
    const rows = await db
      .select()
      .from(releases)
      .where(eq(releases.projectId, projectId))
      .orderBy(releases.createdAt);
    return jsonResponse({ releases: rows, membership });
  });
}

export async function POST(request, { params }) {
  return databaseRoute(async ({ db }) => {
    requireSameOriginMutation(request, "release-create");
    const user = await requireAuthenticatedUser(db, request);
    const { projectId } = await params;
    const membership = await requireProjectCapability(db, {
      projectId,
      userId: user.userId,
      capability: "manage_release",
    });
    const input = await parseJsonBody(request, releaseSchema, 8_192);
    const release = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(releases)
        .values({
          projectId,
          name: input.name,
          description: input.description,
          targetType: input.targetType,
          targetValue:
            input.targetType === "unspecified" ? null : input.targetValue,
          createdBy: user.userId,
        })
        .returning();
      await appendAuditEvent(tx, {
        workspaceId: membership.workspaceId,
        actorId: user.userId,
        actorRole: membership.role,
        action: "release.created",
        targetType: "release",
        targetId: created.id,
        metadata: {
          name: created.name,
          targetType: created.targetType,
          targetValue: created.targetValue,
        },
      });
      return created;
    });
    return jsonResponse({ release }, { status: 201 });
  });
}

