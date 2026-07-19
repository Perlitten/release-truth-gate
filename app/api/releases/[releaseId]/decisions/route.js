import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { jsonResponse } from "../../../../../api/security.mjs";
import {
  claimEvidenceLinks,
  claims,
  decisions,
  evidence,
  memberships,
} from "../../../../../db/schema.js";
import { appendAuditEvent } from "../../../../../src/server/audit.js";
import { HttpError } from "../../../../../src/server/errors.js";
import {
  databaseRoute,
  parseJsonBody,
  requireAuthenticatedUser,
  requireSameOriginMutation,
} from "../../../../../src/server/http.js";
import {
  activeAppendOnlyRecords,
  contentHash,
} from "../../../../../src/server/immutable-records.js";
import { requireReleaseCapability } from "../../../../../src/server/rbac.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const decisionSchema = z
  .object({
    claimId: z.string().uuid(),
    type: z.enum([
      "approval",
      "rejection",
      "risk_acceptance",
      "comment",
      "assignment",
    ]),
    rationale: z.string().trim().min(12).max(12_000),
    assigneeId: z.string().uuid().nullable().optional(),
    reviewedEvidence: z.boolean().default(false),
    basedOnEvidenceIds: z.array(z.string().uuid()).max(100).default([]),
    recordAction: z
      .enum(["snapshot", "correction", "revocation"])
      .default("snapshot"),
    supersedesId: z.string().uuid().nullable().optional(),
    correctionReason: z.string().trim().min(8).max(2_000).nullable().optional(),
  })
  .superRefine((value, context) => {
    if (value.recordAction === "snapshot" && value.supersedesId) {
      context.addIssue({ code: "custom", path: ["supersedesId"], message: "A new decision cannot supersede another record." });
    }
    if (
      value.recordAction !== "snapshot" &&
      (!value.supersedesId || !value.correctionReason)
    ) {
      context.addIssue({ code: "custom", path: ["correctionReason"], message: "Corrections and revocations require a target and reason." });
    }
    if (value.type === "assignment" && !value.assigneeId) {
      context.addIssue({ code: "custom", path: ["assigneeId"], message: "An assignment decision requires an assignee." });
    }
    if (value.type !== "assignment" && value.assigneeId) {
      context.addIssue({ code: "custom", path: ["assigneeId"], message: "Only an assignment decision may set an assignee." });
    }
  });

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
      .from(decisions)
      .where(eq(decisions.releaseId, releaseId))
      .orderBy(decisions.createdAt);
    return jsonResponse({
      decisions: rows,
      activeDecisions: activeAppendOnlyRecords(rows),
      membership,
    });
  });
}

export async function POST(request, { params }) {
  return databaseRoute(async ({ db }) => {
    requireSameOriginMutation(request, "decision-create");
    const user = await requireAuthenticatedUser(db, request);
    const { releaseId } = await params;
    const membership = await requireReleaseCapability(db, {
      releaseId,
      userId: user.userId,
      capability: "create_decision",
    });
    const input = await parseJsonBody(request, decisionSchema, 32_768);
    if (input.type !== "assignment" && !input.reviewedEvidence) {
      throw new HttpError(
        400,
        "You must confirm the evidence was reviewed before recording this decision.",
        "evidence_not_reviewed",
      );
    }
    const [claim] = await db
      .select({ id: claims.id })
      .from(claims)
      .where(and(eq(claims.id, input.claimId), eq(claims.releaseId, releaseId)))
      .limit(1);
    if (!claim) {
      throw new HttpError(400, "The decision claim is not part of this release.", "invalid_decision_claim");
    }
    const uniqueEvidenceIds = [...new Set(input.basedOnEvidenceIds)];
    if (uniqueEvidenceIds.length > 0) {
      const linked = await db
        .select({ id: evidence.id })
        .from(claimEvidenceLinks)
        .innerJoin(evidence, eq(evidence.id, claimEvidenceLinks.evidenceId))
        .where(
          and(
            eq(claimEvidenceLinks.claimId, input.claimId),
            eq(evidence.releaseId, releaseId),
            inArray(evidence.id, uniqueEvidenceIds),
          ),
        );
      if (linked.length !== uniqueEvidenceIds.length) {
        throw new HttpError(
          400,
          "Every decision evidence reference must be linked to the selected claim.",
          "invalid_decision_evidence",
        );
      }
    }
    if (input.type === "assignment") {
      const [assigneeMembership] = await db
        .select({ userId: memberships.userId })
        .from(memberships)
        .where(
          and(
            eq(memberships.workspaceId, membership.workspaceId),
            eq(memberships.userId, input.assigneeId),
          ),
        )
        .limit(1);
      if (!assigneeMembership) {
        throw new HttpError(
          400,
          "The assignee must be a member of this workspace.",
          "invalid_decision_assignee",
        );
      }
    }
    if (input.recordAction !== "snapshot") {
      const [previous] = await db
        .select()
        .from(decisions)
        .where(
          and(
            eq(decisions.id, input.supersedesId),
            eq(decisions.releaseId, releaseId),
          ),
        )
        .limit(1);
      if (!previous || previous.authoredBy !== user.userId) {
        throw new HttpError(
          403,
          "Only the original reviewer may replace or revoke this decision.",
          "decision_revision_forbidden",
        );
      }
    }
    const status =
      input.recordAction === "revocation"
        ? "revoked"
        : input.type === "approval" || input.type === "risk_acceptance"
          ? "approved"
          : input.type === "rejection"
            ? "rejected"
            : "pending";
    const payload = {
      releaseId,
      claimId: input.claimId,
      type: input.type,
      status,
      rationale: input.rationale,
      assigneeId: input.assigneeId || null,
      roleAtDecision: membership.role,
      basedOnEvidenceIds: uniqueEvidenceIds,
      recordAction: input.recordAction,
      supersedesId: input.supersedesId || null,
      correctionReason: input.correctionReason || null,
      authoredBy: user.userId,
    };
    const decision = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(decisions)
        .values({ ...payload, contentHash: contentHash(payload) })
        .returning();
      await appendAuditEvent(tx, {
        workspaceId: membership.workspaceId,
        actorId: user.userId,
        actorRole: membership.role,
        action: `decision.${input.recordAction}`,
        targetType: "decision",
        targetId: created.id,
        metadata: {
          releaseId,
          claimId: input.claimId,
          type: input.type,
          status,
          supersedesId: input.supersedesId || null,
          contentHash: created.contentHash,
        },
      });
      return created;
    });
    return jsonResponse({ decision }, { status: 201 });
  });
}

