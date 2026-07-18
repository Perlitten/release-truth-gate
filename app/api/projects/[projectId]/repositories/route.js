import { eq } from "drizzle-orm";
import { z } from "zod";

import { jsonResponse } from "../../../../../api/security.mjs";
import {
  githubInstallations,
  projectRepositories,
} from "../../../../../db/schema.js";
import { appendAuditEvent } from "../../../../../src/server/audit.js";
import { HttpError } from "../../../../../src/server/errors.js";
import { getInstallationRepository } from "../../../../../src/server/github-app.js";
import {
  databaseRoute,
  parseJsonBody,
  requireAuthenticatedUser,
  requireSameOriginMutation,
} from "../../../../../src/server/http.js";
import { requireProjectCapability } from "../../../../../src/server/rbac.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const linkSchema = z
  .object({
    githubInstallationId: z.string().uuid(),
    owner: z.string().trim().min(1).max(100),
    repository: z.string().trim().min(1).max(100),
  })
  .strict();

export async function GET(request, { params }) {
  return databaseRoute(async ({ db }) => {
    const user = await requireAuthenticatedUser(db, request);
    const { projectId } = await params;
    await requireProjectCapability(db, {
      projectId,
      userId: user.userId,
      capability: "view",
    });
    const repositories = await db
      .select()
      .from(projectRepositories)
      .where(eq(projectRepositories.projectId, projectId));
    return jsonResponse({ repositories });
  });
}

export async function POST(request, { params }) {
  return databaseRoute(async ({ db }) => {
    requireSameOriginMutation(request, "github-repository-link");
    const user = await requireAuthenticatedUser(db, request);
    const { projectId } = await params;
    const membership = await requireProjectCapability(db, {
      projectId,
      userId: user.userId,
      capability: "manage_integrations",
    });
    const input = await parseJsonBody(request, linkSchema, 4_096);
    const [installation] = await db
      .select()
      .from(githubInstallations)
      .where(eq(githubInstallations.id, input.githubInstallationId))
      .limit(1);
    if (
      !installation ||
      installation.workspaceId !== membership.workspaceId ||
      installation.status !== "active"
    ) {
      throw new HttpError(404, "Active GitHub installation not found.", "github_installation_not_found");
    }
    const repository = await getInstallationRepository(
      installation.installationId,
      input.owner,
      input.repository,
    );
    const linked = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(projectRepositories)
        .values({
          projectId,
          githubInstallationId: installation.id,
          repositoryId: String(repository.id),
          ownerLogin: repository.owner.login,
          repositoryName: repository.name,
          defaultBranch: repository.default_branch,
          repositoryUrl: repository.html_url,
          linkedBy: user.userId,
        })
        .onConflictDoUpdate({
          target: [
            projectRepositories.projectId,
            projectRepositories.repositoryId,
          ],
          set: {
            githubInstallationId: installation.id,
            defaultBranch: repository.default_branch,
            repositoryUrl: repository.html_url,
            active: true,
            linkedBy: user.userId,
            updatedAt: new Date(),
          },
        })
        .returning();
      await appendAuditEvent(tx, {
        workspaceId: membership.workspaceId,
        actorId: user.userId,
        actorRole: membership.role,
        action: "github.repository_linked",
        targetType: "project_repository",
        targetId: created.id,
        metadata: {
          projectId,
          repositoryId: created.repositoryId,
          fullName: `${created.ownerLogin}/${created.repositoryName}`,
        },
      });
      return created;
    });
    return jsonResponse({ repository: linked }, { status: 201 });
  });
}
