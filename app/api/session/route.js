import { z } from "zod";
import {
  authenticateAccessCode,
  consumeRateLimit,
  getAnalystAccessState,
  jsonResponse,
  readBoundedText,
  sessionCookieHeader,
  validateSameOrigin,
} from "../../../api/security.mjs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const requestSchema = z.object({
  accessCode: z.string().min(4).max(160),
});

export function GET(request) {
  const access = getAnalystAccessState(request);
  return jsonResponse({
    enabled: access.enabled,
    required: access.required,
    authenticated: access.authenticated,
    actor: access.authenticated ? access.actor : null,
  });
}

export async function POST(request) {
  if (
    !validateSameOrigin(request) ||
    request.headers.get("x-release-truth-request") !== "session"
  ) {
    return jsonResponse({ error: "Cross-site request rejected." }, { status: 403 });
  }

  const rate = consumeRateLimit(request, {
    bucket: "analyst-session",
    limit: 5,
    windowMs: 15 * 60 * 1000,
  });
  if (!rate.allowed) {
    return jsonResponse(
      { error: "Too many access attempts. Try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSeconds) },
      },
    );
  }

  try {
    const body = requestSchema.parse(
      JSON.parse(await readBoundedText(request, 2_048)),
    );
    const result = authenticateAccessCode(body.accessCode);
    if (!result.ok) {
      return jsonResponse(
        {
          error:
            result.reason === "not_configured"
              ? "Analyst access is not configured."
              : "The access code is invalid.",
        },
        { status: result.reason === "not_configured" ? 503 : 401 },
      );
    }

    return jsonResponse(
      { authenticated: true, actor: result.actor },
      {
        headers: {
          "Set-Cookie": sessionCookieHeader(result.token),
        },
      },
    );
  } catch (error) {
    return jsonResponse(
      {
        error:
          error?.code === "BODY_TOO_LARGE"
            ? "The access request is too large."
            : "The access request is invalid.",
      },
      { status: error?.code === "BODY_TOO_LARGE" ? 413 : 400 },
    );
  }
}
