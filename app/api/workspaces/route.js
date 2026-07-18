import { eq } from "drizzle-orm";
import { z } from "zod";

import { jsonResponse } from "../../../api/security.mjs";
import { memberships, workspaces } from "../../../db/schema.js";
import { appendAuditEvent } from "../../../src/server/audit.js";
import {
  databaseRoute,
  parseJsonBody,
  requireAuthenticatedUser,
  requireSameOriginMutation,
} from "../../../src/server/http.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const createSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/)
    .optional(),
});

function slugFromName(name) {
  const normalized = name
    .normalize("NFKD")
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);
  const ascii = normalized.replace(/[^a-z0-9-]/g, "");
  return ascii.length >= 3 ? ascii : `workspace-${crypto.randomUUID().slice(0, 8)}`;
}

export async function GET(request) {
  return databaseRoute(async ({ db }) => {
    const user = await requireAuthenticatedUser(db, request);
    const rows = await db
      .select({
        id: workspaces.id,
        name: workspaces.name,
        slug: workspaces.slug,
        role: memberships.role,
      })
      .from(memberships)
      .innerJoin(workspaces, eq(workspaces.id, memberships.workspaceId))
      .where(eq(memberships.userId, user.userId))
      .orderBy(workspaces.name);
    return jsonResponse({ workspaces: rows });
  });
}

export async function POST(request) {
  return databaseRoute(async ({ db }) => {
    requireSameOriginMutation(request, "workspace-create");
    const user = await requireAuthenticatedUser(db, request);
    const input = await parseJsonBody(request, createSchema, 4_096);
    const slug = input.slug || slugFromName(input.name);

    const workspace = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(workspaces)
        .values({
          name: input.name,
          slug,
          createdBy: user.userId,
        })
        .returning({
          id: workspaces.id,
          name: workspaces.name,
          slug: workspaces.slug,
        });
      await tx.insert(memberships).values({
        workspaceId: created.id,
        userId: user.userId,
        role: "owner",
      });
      await appendAuditEvent(tx, {
        workspaceId: created.id,
        actorId: user.userId,
        actorRole: "owner",
        action: "workspace.created",
        targetType: "workspace",
        targetId: created.id,
        metadata: { name: created.name, slug: created.slug },
      });
      return { ...created, role: "owner" };
    });

    return jsonResponse({ workspace }, { status: 201 });
  });
}

