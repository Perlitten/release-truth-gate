import path from "node:path";
import dotenv from "dotenv";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import {
  analysisRequestSchema,
  analystInstructions,
  buildAnalysisInput,
  evidenceAssessmentSchema,
} from "../../../api/schema.mjs";

dotenv.config({
  path: path.resolve(process.cwd(), "../.env.local"),
  quiet: true,
});

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request) {
  if (!process.env.OPENAI_API_KEY) {
    return Response.json(
      { error: "OpenAI API is not configured." },
      { status: 503 },
    );
  }

  try {
    const rawBody = await request.text();
    if (rawBody.length > 100_000) {
      return Response.json(
        { error: "The evidence request is too large." },
        { status: 413 },
      );
    }

    const payload = analysisRequestSchema.parse(JSON.parse(rawBody));
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const model = process.env.OPENAI_MODEL || "gpt-5.6-terra";
    const result = await client.responses.parse({
      model,
      reasoning: { effort: "medium" },
      instructions: analystInstructions,
      input: buildAnalysisInput(payload),
      text: {
        format: zodTextFormat(evidenceAssessmentSchema, "evidence_assessment"),
      },
    });

    if (!result.output_parsed) {
      throw new Error("The model returned no structured assessment.");
    }

    return Response.json({
      assessment: result.output_parsed,
      model,
      responseId: result.id,
    });
  } catch (error) {
    const isInvalidRequest =
      error?.name === "ZodError" || error instanceof SyntaxError;

    console.error("Evidence review failed:", error);
    return Response.json(
      {
        error: isInvalidRequest
          ? "The evidence request is invalid."
          : "The evidence review could not be completed.",
      },
      { status: isInvalidRequest ? 400 : 502 },
    );
  }
}
