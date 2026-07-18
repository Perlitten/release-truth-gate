import path from "node:path";
import dotenv from "dotenv";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import {
  analysisRequestSchema,
  analystInstructions,
  buildAnalysisInput,
  evidenceAssessmentSchema,
  groundAssessment,
} from "../../../api/schema.mjs";
import {
  consumeRateLimit,
  getAnalystAccessState,
  jsonResponse,
  readBoundedText,
  validateSameOrigin,
} from "../../../api/security.mjs";

if (process.env.NODE_ENV !== "production") {
  dotenv.config({
    path: path.resolve(process.cwd(), "../.env.local"),
    quiet: true,
  });
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_REQUEST_BYTES = 48_000;
const OPENAI_TIMEOUT_MS = 25_000;
const MAX_OUTPUT_TOKENS = 900;

function logOutcome({ requestId, outcome, startedAt, model, sourceCount }) {
  console.info(
    JSON.stringify({
      event: "release_truth_ai_review",
      requestId,
      outcome,
      durationMs: Date.now() - startedAt,
      model,
      sourceCount,
    }),
  );
}

export async function POST(request) {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();

  if (
    !validateSameOrigin(request) ||
    request.headers.get("x-release-truth-request") !== "analyze"
  ) {
    return jsonResponse(
      { error: "Cross-site request rejected.", requestId },
      { status: 403 },
    );
  }

  const access = getAnalystAccessState(request);
  if (!access.enabled) {
    return jsonResponse(
      {
        error: "AI review is disabled until access control is configured.",
        requestId,
      },
      { status: 503 },
    );
  }
  if (access.required && !access.authenticated) {
    return jsonResponse(
      { error: "AI review requires an authenticated analyst session.", requestId },
      { status: 401 },
    );
  }

  const rate = consumeRateLimit(request, {
    bucket: "ai-analysis",
    limit: 8,
    windowMs: 10 * 60 * 1000,
  });
  if (!rate.allowed) {
    return jsonResponse(
      { error: "AI review rate limit reached. Try again later.", requestId },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSeconds) },
      },
    );
  }

  if (!process.env.OPENAI_API_KEY) {
    return jsonResponse(
      { error: "OpenAI API is not configured.", requestId },
      { status: 503 },
    );
  }

  let model = process.env.OPENAI_MODEL || "gpt-5.6-terra";
  let sourceCount = 0;

  try {
    const rawBody = await readBoundedText(request, MAX_REQUEST_BYTES);
    const payload = analysisRequestSchema.parse(JSON.parse(rawBody));
    sourceCount = payload.sources.length;

    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      maxRetries: 1,
      timeout: OPENAI_TIMEOUT_MS,
    });
    const result = await client.responses.parse(
      {
        model,
        reasoning: { effort: "medium" },
        instructions: analystInstructions,
        input: buildAnalysisInput(payload),
        max_output_tokens: MAX_OUTPUT_TOKENS,
        store: false,
        text: {
          format: zodTextFormat(evidenceAssessmentSchema, "evidence_assessment"),
        },
      },
      {
        timeout: OPENAI_TIMEOUT_MS,
        maxRetries: 1,
        signal: AbortSignal.timeout(OPENAI_TIMEOUT_MS),
      },
    );

    if (!result.output_parsed) {
      throw new Error("The model returned no structured assessment.");
    }

    const assessment = groundAssessment(payload, result.output_parsed);
    const analyzedAt = new Date().toISOString();
    const evidenceHead = `${payload.claim.currentRevision}@${payload.sources
      .map((source) => source.revision)
      .sort()
      .join("+")}`;

    logOutcome({
      requestId,
      outcome: "success",
      startedAt,
      model,
      sourceCount,
    });

    return jsonResponse(
      {
        assessment,
        mode: "live",
        model,
        responseId: result.id,
        requestId,
        analyzedAt,
        evidenceHead,
        retention: "not_stored_by_application_request",
      },
      {
        headers: {
          "Server-Timing": `ai;dur=${Date.now() - startedAt}`,
          "X-RateLimit-Remaining": String(rate.remaining),
        },
      },
    );
  } catch (error) {
    const bodyTooLarge = error?.code === "BODY_TOO_LARGE";
    const invalidRequest =
      error?.name === "ZodError" || error instanceof SyntaxError;
    const timedOut =
      error?.name === "AbortError" ||
      error?.code === "ETIMEDOUT" ||
      error?.status === 408;
    const status = bodyTooLarge
      ? 413
      : invalidRequest
        ? 400
        : timedOut
          ? 504
          : 502;
    const message = bodyTooLarge
      ? "The evidence request is too large."
      : invalidRequest
        ? "The evidence request is invalid."
        : timedOut
          ? "The evidence review timed out."
          : "The evidence review could not be completed or grounded.";

    console.error(
      JSON.stringify({
        event: "release_truth_ai_review_error",
        requestId,
        errorName: error?.name || "Error",
        errorCode: error?.code || null,
        status,
      }),
    );
    logOutcome({
      requestId,
      outcome: `error_${status}`,
      startedAt,
      model,
      sourceCount,
    });

    return jsonResponse({ error: message, requestId }, { status });
  }
}
