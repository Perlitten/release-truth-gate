import { and, eq } from "drizzle-orm";

import { jsonResponse } from "../../../../api/security.mjs";
import {
  memberships,
  workspaces,
} from "../../../../db/schema.js";
import {
  databaseRoute,
  requireAuthenticatedUser,
} from "../../../../src/server/http.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request) {
  return databaseRoute(async ({ db }) => {
    const session = await requireAuthenticatedUser(db, request);
    const accessibleWorkspaces = await db
      .select({
        id: workspaces.id,
        name: workspaces.name,
        slug: workspaces.slug,
        role: memberships.role,
      })
      .from(memberships)
      .innerJoin(workspaces, eq(workspaces.id, memberships.workspaceId))
      .where(eq(memberships.userId, session.userId))
      .orderBy(workspaces.name);

    return jsonResponse({
      user: {
        id: session.userId,
        email: session.email,
        displayName: session.displayName,
      },
      workspaces: accessibleWorkspaces,
    });
  });
}

