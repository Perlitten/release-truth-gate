import { ZodError } from "zod";

import {
  jsonResponse,
  readBoundedText,
  validateSameOrigin,
} from "../../api/security.mjs";
import { DatabaseUnavailableError, withDatabase } from "../../db/connection.js";
import { getUserSession } from "./auth/sessions.js";
import { HttpError } from "./errors.js";

export async function parseJsonBody(request, schema, maxBytes = 16_384) {
  return schema.parse(JSON.parse(await readBoundedText(request, maxBytes)));
}

export function requireSameOriginMutation(request, marker) {
  if (
    !validateSameOrigin(request) ||
    request.headers.get("x-release-truth-request") !== marker
  ) {
    throw new HttpError(403, "Cross-site request rejected.", "csrf_rejected");
  }
}

export async function requireAuthenticatedUser(db, request) {
  const session = await getUserSession(db, request);
  if (!session) {
    throw new HttpError(401, "Authentication required.", "unauthenticated");
  }
  return session;
}

export async function databaseRoute(handler) {
  const requestId = crypto.randomUUID();
  try {
    return await withDatabase((db, client) =>
      handler({ db, client, requestId }),
    );
  } catch (error) {
    const bodyTooLarge = error?.code === "BODY_TOO_LARGE";
    const invalid = error instanceof ZodError || error instanceof SyntaxError;
    const conflict = error?.code === "23505";
    const unavailable = error instanceof DatabaseUnavailableError;
    const status =
      error instanceof HttpError
        ? error.status
        : bodyTooLarge
          ? 413
          : invalid
            ? 400
            : conflict
              ? 409
              : unavailable
                ? 503
                : 500;
    const code =
      error instanceof HttpError
        ? error.code
        : bodyTooLarge
          ? "body_too_large"
          : invalid
            ? "invalid_request"
            : conflict
              ? "conflict"
              : unavailable
                ? "database_unavailable"
                : "internal_error";
    const message =
      error instanceof HttpError
        ? error.message
        : status === 413
          ? "The request body is too large."
          : status === 400
            ? "The request is invalid."
            : status === 409
              ? "The requested record already exists."
              : status === 503
                ? "The shared database is unavailable."
                : "The request could not be completed.";

    if (status >= 500) {
      console.error(
        JSON.stringify({
          event: "release_truth_server_error",
          requestId,
          errorName: error?.name || "Error",
          errorCode: error?.code || null,
          status,
        }),
      );
    }
    return jsonResponse({ error: message, code, requestId }, { status });
  }
}

