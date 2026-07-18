import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { jsonResponse } from "../../../../../api/security.mjs";
import {
  claimEvidenceLinks,
  claims,
  decisions,
  evidence,
  verdictRuns,
} from "../../../../../db/schema.js";
import { appendAuditEvent } from "../../../../../src/server/audit.js";
import {
  databaseRoute,
  parseJsonBody,
  requireAuthenticatedUser,
  requireSameOriginMutation,
} from "../../../../../src/server/http.js";
import { contentHash } from "../../../../../src/server/immutable-records.js";
import { requireReleaseCapability } from "../../../../../src/server/rbac.js";
import {
  buildVerdictInput,
  ENGINE_VERSION,
  evaluateVerdict,
  POLICY_VERSION,
} from "../../../../../src/server/verdict-engine.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const runSchema = z.object({}).strict();

async function loadInputs(db, releaseId) {
  const claimRows = await db.select().from(claims).where(eq(claims.releaseId, releaseId));
  const evidenceRows = await db.select().from(evidence).where(eq(evidence.releaseId, releaseId));
  const decisionRows = await db.select().from(decisions).where(eq(decisions.releaseId, releaseId));
  const links = await db
    .select({
      claimId: claimEvidenceLinks.claimId,
      evidenceId: claimEvidenceLinks.evidenceId,
    })
    .from(claimEvidenceLinks)
    .innerJoin(claims, eq(claims.id, claimEvidenceLinks.claimId))
    .where(eq(claims.releaseId, releaseId));
  return { claims: claimRows, evidence: evidenceRows, decisions: decisionRows, links };
}

export async function GET(request, { params }) {
  return databaseRoute(async ({ db }) => {
    const user = await requireAuthenticatedUser(db, request);
    const { releaseId } = await params;
    const membership = await requireReleaseCapability(db, {
      releaseId,
      userId: user.userId,
      capability: "view",
    });
    const rows = await db
      .select()
      .from(verdictRuns)
      .where(eq(verdictRuns.releaseId, releaseId))
      .orderBy(verdictRuns.createdAt);
    return jsonResponse({ verdictRuns: rows, membership });
  });
}

export async function POST(request, { params }) {
  return databaseRoute(async ({ db }) => {
    requireSameOriginMutation(request, "verdict-run");
    const user = await requireAuthenticatedUser(db, request);
    const { releaseId } = await params;
    const membership = await requireReleaseCapability(db, {
      releaseId,
      userId: user.userId,
      capability: "run_verdict",
    });
    await parseJsonBody(request, runSchema, 1_024);
    const input = buildVerdictInput(await loadInputs(db, releaseId));
    const inputDigest = contentHash(input.snapshot);
    const [existing] = await db
      .select()
      .from(verdictRuns)
      .where(
        and(
          eq(verdictRuns.releaseId, releaseId),
          eq(verdictRuns.engineVersion, ENGINE_VERSION),
          eq(verdictRuns.inputDigest, inputDigest),
        ),
      )
      .limit(1);
    if (existing) {
      return jsonResponse({ verdictRun: existing, reused: true });
    }
    const evaluation = evaluateVerdict(input);
    const verdictRun = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(verdictRuns)
        .values({
          releaseId,
          engineVersion: ENGINE_VERSION,
          policyVersion: POLICY_VERSION,
          inputSnapshot: input.snapshot,
          inputDigest,
          result: evaluation.result,
          reasonCodes: evaluation.reasonCodes,
          initiatedBy: user.userId,
        })
        .returning();
      await appendAuditEvent(tx, {
        workspaceId: membership.workspaceId,
        actorId: user.userId,
        actorRole: membership.role,
        action: "verdict.run",
        targetType: "verdict_run",
        targetId: created.id,
        metadata: {
          releaseId,
          engineVersion: ENGINE_VERSION,
          inputDigest,
          result: evaluation.result.status,
          reasonCodes: evaluation.reasonCodes,
        },
      });
      return created;
    });
    return jsonResponse({ verdictRun, reused: false }, { status: 201 });
  });
}

