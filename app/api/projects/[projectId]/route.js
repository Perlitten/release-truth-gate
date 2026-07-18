import { eq } from "drizzle-orm";
import { z } from "zod";

import { jsonResponse } from "../../../../api/security.mjs";
import { projects } from "../../../../db/schema.js";
import { appendAuditEvent } from "../../../../src/server/audit.js";
import {
  databaseRoute,
  parseJsonBody,
  requireAuthenticatedUser,
  requireSameOriginMutation,
} from "../../../../src/server/http.js";
import { requireProjectCapability } from "../../../../src/server/rbac.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const updateSchema = z
  .object({
    name: z.string().trim().min(2).max(160).optional(),
    description: z.string().trim().max(4_000).optional(),
    archived: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0);

export async function GET(request, { params }) {
  return databaseRoute(async ({ db }) => {
    const user = await requireAuthenticatedUser(db, request);
    const { projectId } = await params;
    const membership = await requireProjectCapability(db, {
      projectId,
      userId: user.userId,
      capability: "view",
    });
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);
    return jsonResponse({ project, membership });
  });
}

export async function PATCH(request, { params }) {
  return databaseRoute(async ({ db }) => {
    requireSameOriginMutation(request, "project-update");
    const user = await requireAuthenticatedUser(db, request);
    const { projectId } = await params;
    const membership = await requireProjectCapability(db, {
      projectId,
      userId: user.userId,
      capability: "create_project",
    });
    const input = await parseJsonBody(request, updateSchema, 8_192);
    const values = {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined
        ? { description: input.description }
        : {}),
      ...(input.archived !== undefined
        ? { archivedAt: input.archived ? new Date() : null }
        : {}),
      updatedAt: new Date(),
    };

    const project = await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(projects)
        .set(values)
        .where(eq(projects.id, projectId))
        .returning();
      await appendAuditEvent(tx, {
        workspaceId: membership.workspaceId,
        actorId: user.userId,
        actorRole: membership.role,
        action: "project.updated",
        targetType: "project",
        targetId: projectId,
        metadata: { fields: Object.keys(input) },
      });
      return updated;
    });
    return jsonResponse({ project });
  });
}

