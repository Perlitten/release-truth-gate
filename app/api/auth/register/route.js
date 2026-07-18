import { eq, sql } from "drizzle-orm";
import { z } from "zod";

import { consumeRateLimit, jsonResponse } from "../../../../api/security.mjs";
import { users } from "../../../../db/schema.js";
import {
  createUserSession,
  userSessionCookieHeader,
} from "../../../../src/server/auth/sessions.js";
import {
  derivePassword,
  normalizeEmail,
} from "../../../../src/server/auth/passwords.js";
import {
  databaseRoute,
  parseJsonBody,
  requireSameOriginMutation,
} from "../../../../src/server/http.js";
import { HttpError } from "../../../../src/server/errors.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const requestSchema = z.object({
  email: z.string().trim().email().max(254),
  displayName: z.string().trim().min(2).max(120),
  password: z.string().min(12).max(128),
});

export async function POST(request) {
  return databaseRoute(async ({ db }) => {
    requireSameOriginMutation(request, "auth-register");
    const rate = consumeRateLimit(request, {
      bucket: "user-register",
      limit: 5,
      windowMs: 30 * 60 * 1000,
    });
    if (!rate.allowed) {
      throw new HttpError(
        429,
        "Too many registration attempts. Try again later.",
        "rate_limited",
      );
    }

    const input = await parseJsonBody(request, requestSchema, 4_096);
    const email = normalizeEmail(input.email);
    const password = await derivePassword(input.password);

    const result = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: users.id })
        .from(users)
        .where(sql`lower(${users.email}) = ${email}`)
        .limit(1);
      if (existing) {
        throw new HttpError(
          409,
          "An account with this email already exists.",
          "email_exists",
        );
      }

      const [user] = await tx
        .insert(users)
        .values({
          email,
          displayName: input.displayName,
          passwordHash: password.hash,
          passwordSalt: password.salt,
          passwordIterations: password.iterations,
        })
        .returning({
          id: users.id,
          email: users.email,
          displayName: users.displayName,
        });
      const session = await createUserSession(tx, user.id);
      return { user, session };
    });

    return jsonResponse(
      { user: result.user, workspaces: [] },
      {
        status: 201,
        headers: {
          "Set-Cookie": userSessionCookieHeader(result.session),
          "X-RateLimit-Remaining": String(rate.remaining),
        },
      },
    );
  });
}

