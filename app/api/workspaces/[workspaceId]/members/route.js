import { eq } from "drizzle-orm";

import { jsonResponse } from "../../../../../api/security.mjs";
import { memberships, users } from "../../../../../db/schema.js";
import {
  databaseRoute,
  requireAuthenticatedUser,
} from "../../../../../src/server/http.js";
import { requireWorkspaceCapability } from "../../../../../src/server/rbac.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request, context) {
  return databaseRoute(async ({ db }) => {
    const user = await requireAuthenticatedUser(db, request);
    const { workspaceId } = await context.params;
    await requireWorkspaceCapability(db, {
      workspaceId,
      userId: user.userId,
      capability: "view",
    });

    const rows = await db
      .select({
        userId: users.id,
        email: users.email,
        displayName: users.displayName,
        role: memberships.role,
        joinedAt: memberships.createdAt,
      })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(eq(memberships.workspaceId, workspaceId))
      .orderBy(users.displayName);

    return jsonResponse({ members: rows });
  });
}

