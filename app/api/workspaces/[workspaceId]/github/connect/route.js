import { eq } from "drizzle-orm";

import { jsonResponse } from "../../../../../../api/security.mjs";
import { githubOauthStates } from "../../../../../../db/schema.js";
import {
  databaseRoute,
  requireAuthenticatedUser,
  requireSameOriginMutation,
} from "../../../../../../src/server/http.js";
import { requireWorkspaceCapability } from "../../../../../../src/server/rbac.js";
import {
  createGitHubState,
  githubInstallUrl,
} from "../../../../../../src/server/github-app.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request, { params }) {
  return databaseRoute(async ({ db }) => {
    requireSameOriginMutation(request, "github-connect");
    const user = await requireAuthenticatedUser(db, request);
    const { workspaceId } = await params;
    await requireWorkspaceCapability(db, {
      workspaceId,
      userId: user.userId,
      capability: "manage_integrations",
    });
    const generated = createGitHubState();
    await db
      .delete(githubOauthStates)
      .where(eq(githubOauthStates.initiatedBy, user.userId));
    await db.insert(githubOauthStates).values({
      workspaceId,
      initiatedBy: user.userId,
      stateHash: generated.stateHash,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });
    return jsonResponse({
      installUrl: githubInstallUrl(generated.state),
      expiresInSeconds: 600,
    });
  });
}
