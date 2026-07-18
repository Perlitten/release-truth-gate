import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import { jsonResponse } from "../../../../../api/security.mjs";
import { projects } from "../../../../../db/schema.js";
import { appendAuditEvent } from "../../../../../src/server/audit.js";
import {
  databaseRoute,
  parseJsonBody,
  requireAuthenticatedUser,
  requireSameOriginMutation,
} from "../../../../../src/server/http.js";
import { requireWorkspaceCapability } from "../../../../../src/server/rbac.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const projectSchema = z.object({
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(4_000).default(""),
});

export async function GET(request, { params }) {
  return databaseRoute(async ({ db }) => {
    const user = await requireAuthenticatedUser(db, request);
    const { workspaceId } = await params;
    const membership = await requireWorkspaceCapability(db, {
      workspaceId,
      userId: user.userId,
      capability: "view",
    });
    const rows = await db
      .select()
      .from(projects)
      .where(
        and(
          eq(projects.workspaceId, workspaceId),
          isNull(projects.archivedAt),
        ),
      )
      .orderBy(projects.name);
    return jsonResponse({ projects: rows, membership });
  });
}

export async function POST(request, { params }) {
  return databaseRoute(async ({ db }) => {
    requireSameOriginMutation(request, "project-create");
    const user = await requireAuthenticatedUser(db, request);
    const { workspaceId } = await params;
    const membership = await requireWorkspaceCapability(db, {
      workspaceId,
      userId: user.userId,
      capability: "create_project",
    });
    const input = await parseJsonBody(request, projectSchema, 8_192);

    const project = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(projects)
        .values({
          workspaceId,
          name: input.name,
          description: input.description,
          createdBy: user.userId,
        })
        .returning();
      await appendAuditEvent(tx, {
        workspaceId,
        actorId: user.userId,
        actorRole: membership.role,
        action: "project.created",
        targetType: "project",
        targetId: created.id,
        metadata: { name: created.name },
      });
      return created;
    });

    return jsonResponse({ project }, { status: 201 });
  });
}

