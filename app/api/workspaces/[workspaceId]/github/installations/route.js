import { eq } from "drizzle-orm";

import { jsonResponse } from "../../../../../../api/security.mjs";
import { githubInstallations } from "../../../../../../db/schema.js";
import {
  listInstallationRepositories,
} from "../../../../../../src/server/github-app.js";
import {
  databaseRoute,
  requireAuthenticatedUser,
} from "../../../../../../src/server/http.js";
import { requireWorkspaceCapability } from "../../../../../../src/server/rbac.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request, { params }) {
  return databaseRoute(async ({ db }) => {
    const user = await requireAuthenticatedUser(db, request);
    const { workspaceId } = await params;
    await requireWorkspaceCapability(db, {
      workspaceId,
      userId: user.userId,
      capability: "manage_integrations",
    });
    const installations = await db
      .select()
      .from(githubInstallations)
      .where(eq(githubInstallations.workspaceId, workspaceId));
    const includeRepositories =
      new URL(request.url).searchParams.get("repositories") === "true";
    if (!includeRepositories) return jsonResponse({ installations });
    const hydrated = [];
    for (const installation of installations) {
      hydrated.push({
        ...installation,
        repositories:
          installation.status === "active"
            ? (await listInstallationRepositories(installation.installationId)).map(
                (repository) => ({
                  id: String(repository.id),
                  owner: repository.owner.login,
                  name: repository.name,
                  fullName: repository.full_name,
                  defaultBranch: repository.default_branch,
                  url: repository.html_url,
                  private: repository.private,
                }),
              )
            : [],
      });
    }
    return jsonResponse({ installations: hydrated });
  });
}
