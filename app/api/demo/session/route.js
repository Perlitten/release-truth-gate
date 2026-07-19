import { randomBytes } from "node:crypto";

import { eq, sql } from "drizzle-orm";

import { consumeRateLimit, jsonResponse } from "../../../../api/security.mjs";
import { memberships, users, workspaces } from "../../../../db/schema.js";
import {
  createUserSession,
  userSessionCookieHeader,
} from "../../../../src/server/auth/sessions.js";
import {
  derivePassword,
  normalizeEmail,
} from "../../../../src/server/auth/passwords.js";
import { HttpError } from "../../../../src/server/errors.js";
import {
  databaseRoute,
  requireSameOriginMutation,
} from "../../../../src/server/http.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEMO_WORKSPACE_SLUG = "nova-demo";
const DEMO_JUDGE_EMAIL = "judge@nova-demo.local";
const DEMO_JUDGE_NAME = "Guest Judge";

function demoSessionsEnabled() {
  return (
    process.env.NODE_ENV !== "production" || process.env.DEMO_MODE === "true"
  );
}

export async function POST(request) {
  return databaseRoute(async ({ db }) => {
    requireSameOriginMutation(request, "demo-session");
    if (!demoSessionsEnabled()) {
      throw new HttpError(
        404,
        "The guided demo is not enabled on this server.",
        "demo_disabled",
      );
    }
    const rate = consumeRateLimit(request, {
      bucket: "demo-session",
      limit: 20,
      windowMs: 15 * 60 * 1000,
    });
    if (!rate.allowed) {
      throw new HttpError(
        429,
        "Too many demo requests. Try again later.",
        "rate_limited",
      );
    }

    const [workspace] = await db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(sql`lower(${workspaces.slug}) = ${DEMO_WORKSPACE_SLUG}`)
      .limit(1);
    if (!workspace) {
      throw new HttpError(
        404,
        "The Nova 2.4 demo workspace is not installed on this server.",
        "demo_not_installed",
      );
    }

    const email = normalizeEmail(DEMO_JUDGE_EMAIL);
    const result = await db.transaction(async (tx) => {
      let [user] = await tx
        .select({
          id: users.id,
          email: users.email,
          displayName: users.displayName,
        })
        .from(users)
        .where(sql`lower(${users.email}) = ${email}`)
        .limit(1);

      if (!user) {
        // The judge account is reachable only through this route: the random
        // password is discarded, so the normal login form cannot use it.
        const password = await derivePassword(
          randomBytes(32).toString("base64url"),
        );
        [user] = await tx
          .insert(users)
          .values({
            email,
            displayName: DEMO_JUDGE_NAME,
            passwordHash: password.hash,
            passwordSalt: password.salt,
            passwordIterations: password.iterations,
            emailVerifiedAt: new Date(),
          })
          .returning({
            id: users.id,
            email: users.email,
            displayName: users.displayName,
          });
      }

      await tx
        .insert(memberships)
        .values({
          workspaceId: workspace.id,
          userId: user.id,
          role: "reviewer",
        })
        .onConflictDoNothing();

      const session = await createUserSession(tx, user.id);
      return { user, session };
    });

    return jsonResponse(
      { user: { ...result.user, isDemo: true } },
      {
        headers: {
          "Set-Cookie": userSessionCookieHeader(result.session),
          "X-RateLimit-Remaining": String(rate.remaining),
        },
      },
    );
  });
}
