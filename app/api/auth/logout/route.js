import { jsonResponse } from "../../../../api/security.mjs";
import {
  clearUserSessionCookieHeader,
  revokeRequestSession,
} from "../../../../src/server/auth/sessions.js";
import {
  databaseRoute,
  requireSameOriginMutation,
} from "../../../../src/server/http.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request) {
  return databaseRoute(async ({ db }) => {
    requireSameOriginMutation(request, "auth-logout");
    await revokeRequestSession(db, request);
    return jsonResponse(
      { authenticated: false },
      { headers: { "Set-Cookie": clearUserSessionCookieHeader() } },
    );
  });
}

