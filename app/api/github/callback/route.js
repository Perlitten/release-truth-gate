import { and, eq, gt, isNull } from "drizzle-orm";

import { githubInstallations, githubOauthStates } from "../../../../db/schema.js";
import { appendAuditEvent } from "../../../../src/server/audit.js";
import { HttpError } from "../../../../src/server/errors.js";
import {
  exchangeGitHubOAuthCode,
  getGitHubInstallation,
  githubAuthorizeUrl,
  hashGitHubState,
  listUserGitHubInstallations,
} from "../../../../src/server/github-app.js";
import {
  databaseRoute,
  requireAuthenticatedUser,
} from "../../../../src/server/http.js";
import { requireWorkspaceCapability } from "../../../../src/server/rbac.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function applicationOrigin(request) {
  return process.env.APP_ORIGIN || new URL(request.url).origin;
}

export async function GET(request) {
  return databaseRoute(async ({ db }) => {
    const user = await requireAuthenticatedUser(db, request);
    const url = new URL(request.url);
    const state = url.searchParams.get("state");
    const installationId = url.searchParams.get("installation_id");
    const code = url.searchParams.get("code");
    if (!state || (!installationId && !code)) {
      throw new HttpError(400, "The GitHub callback is incomplete.", "github_callback_invalid");
    }
    const [pending] = await db
      .select()
      .from(githubOauthStates)
      .where(
        and(
          eq(githubOauthStates.stateHash, hashGitHubState(state)),
          gt(githubOauthStates.expiresAt, new Date()),
          isNull(githubOauthStates.consumedAt),
        ),
      )
      .limit(1);
    if (!pending || pending.initiatedBy !== user.userId) {
      throw new HttpError(400, "The GitHub authorization state is invalid or expired.", "github_state_invalid");
    }
    const membership = await requireWorkspaceCapability(db, {
      workspaceId: pending.workspaceId,
      userId: user.userId,
      capability: "manage_integrations",
    });

    if (installationId && !code) {
      await getGitHubInstallation(installationId);
      await db
        .update(githubOauthStates)
        .set({ installationId })
        .where(eq(githubOauthStates.id, pending.id));
      return Response.redirect(githubAuthorizeUrl(state), 303);
    }

    if (!pending.installationId) {
      throw new HttpError(400, "The GitHub installation was not selected.", "github_installation_missing");
    }
    const userToken = await exchangeGitHubOAuthCode(code);
    const accessible = await listUserGitHubInstallations(userToken);
    const installation = accessible.find(
      (item) => String(item.id) === String(pending.installationId),
    );
    if (!installation) {
      throw new HttpError(
        403,
        "Your GitHub account cannot administer this installation.",
        "github_installation_forbidden",
      );
    }
    const [existing] = await db
      .select()
      .from(githubInstallations)
      .where(eq(githubInstallations.installationId, String(installation.id)))
      .limit(1);
    if (existing && existing.workspaceId !== pending.workspaceId) {
      throw new HttpError(
        409,
        "This GitHub installation is already connected to another workspace.",
        "github_installation_conflict",
      );
    }
    await db.transaction(async (tx) => {
      const values = {
        workspaceId: pending.workspaceId,
        installationId: String(installation.id),
        accountLogin: installation.account.login,
        accountId: String(installation.account.id),
        accountType: installation.account.type,
        repositorySelection: installation.repository_selection,
        status: "active",
        installedBy: user.userId,
        suspendedAt: null,
        deletedAt: null,
        updatedAt: new Date(),
      };
      const [connected] = existing
        ? await tx
            .update(githubInstallations)
            .set(values)
            .where(eq(githubInstallations.id, existing.id))
            .returning()
        : await tx.insert(githubInstallations).values(values).returning();
      await tx
        .update(githubOauthStates)
        .set({ consumedAt: new Date() })
        .where(eq(githubOauthStates.id, pending.id));
      await appendAuditEvent(tx, {
        workspaceId: pending.workspaceId,
        actorId: user.userId,
        actorRole: membership.role,
        action: "github.installation_connected",
        targetType: "github_installation",
        targetId: connected.id,
        metadata: {
          installationId: connected.installationId,
          accountLogin: connected.accountLogin,
          repositorySelection: connected.repositorySelection,
        },
      });
    });
    const target = new URL(applicationOrigin(request));
    target.searchParams.set("github", "connected");
    return Response.redirect(target, 303);
  });
}
