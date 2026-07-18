import { sql } from "drizzle-orm";
import { z } from "zod";

import { consumeRateLimit, jsonResponse } from "../../../../api/security.mjs";
import { users } from "../../../../db/schema.js";
import {
  createUserSession,
  userSessionCookieHeader,
} from "../../../../src/server/auth/sessions.js";
import {
  consumeDummyPasswordWork,
  normalizeEmail,
  verifyPassword,
} from "../../../../src/server/auth/passwords.js";
import { HttpError } from "../../../../src/server/errors.js";
import {
  databaseRoute,
  parseJsonBody,
  requireSameOriginMutation,
} from "../../../../src/server/http.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const requestSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(128),
});

export async function POST(request) {
  return databaseRoute(async ({ db }) => {
    requireSameOriginMutation(request, "auth-login");
    const rate = consumeRateLimit(request, {
      bucket: "user-login",
      limit: 8,
      windowMs: 15 * 60 * 1000,
    });
    if (!rate.allowed) {
      throw new HttpError(
        429,
        "Too many login attempts. Try again later.",
        "rate_limited",
      );
    }

    const input = await parseJsonBody(request, requestSchema, 4_096);
    const email = normalizeEmail(input.email);
    const [user] = await db
      .select()
      .from(users)
      .where(sql`lower(${users.email}) = ${email}`)
      .limit(1);

    if (!user || user.disabledAt) {
      await consumeDummyPasswordWork(input.password);
      throw new HttpError(401, "Email or password is invalid.", "invalid_login");
    }

    const valid = await verifyPassword(input.password, {
      hash: user.passwordHash,
      salt: user.passwordSalt,
      iterations: user.passwordIterations,
    });
    if (!valid) {
      throw new HttpError(401, "Email or password is invalid.", "invalid_login");
    }

    const session = await db.transaction((tx) => createUserSession(tx, user.id));
    return jsonResponse(
      {
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
        },
      },
      {
        headers: {
          "Set-Cookie": userSessionCookieHeader(session),
          "X-RateLimit-Remaining": String(rate.remaining),
        },
      },
    );
  });
}

