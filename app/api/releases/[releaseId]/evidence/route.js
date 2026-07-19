import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { jsonResponse } from "../../../../../api/security.mjs";
import {
  claimEvidenceLinks,
  claims,
  evidence,
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
import { isAllowedSourceUrl } from "../../../../../src/lib/source-url.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const evidenceSchema = z.object({
  summary: z.string().trim().min(2).max(12_000),
  relation: z.enum(["supports", "contradicts", "missing"]),
  evidenceKind: z.string().trim().min(1).max(64),
  sourceUrl: z
    .string()
    .trim()
    .url()
    .max(2_000)
    .refine(isAllowedSourceUrl, "Source URL must use http or https.")
    .nullable()
    .optional(),
  sourceReference: z.string().trim().max(500).nullable().optional(),
  authorName: z.string().trim().max(160).nullable().optional(),
  capturedAt: z.coerce.date().optional(),
  claimIds: z.array(z.string().uuid()).min(1).max(50),
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
      .from(evidence)
      .where(eq(evidence.releaseId, releaseId))
      .orderBy(evidence.createdAt);
    const linked = await db
      .select({
        claimId: claimEvidenceLinks.claimId,
        evidenceId: claimEvidenceLinks.evidenceId,
        createdAt: claimEvidenceLinks.createdAt,
      })
      .from(claimEvidenceLinks)
      .innerJoin(claims, eq(claims.id, claimEvidenceLinks.claimId))
      .where(eq(claims.releaseId, releaseId));
    return jsonResponse({
      evidence: rows,
      activeEvidence: activeAppendOnlyRecords(rows),
      links: linked,
      membership,
    });
  });
}

export async function POST(request, { params }) {
  return databaseRoute(async ({ db }) => {
    requireSameOriginMutation(request, "evidence-create");
    const user = await requireAuthenticatedUser(db, request);
    const { releaseId } = await params;
    const membership = await requireReleaseCapability(db, {
      releaseId,
      userId: user.userId,
      capability: "create_evidence",
    });
    const input = await parseJsonBody(request, evidenceSchema, 32_768);
    const uniqueClaimIds = [...new Set(input.claimIds)];
    const matchingClaims = await db
      .select({ id: claims.id })
      .from(claims)
      .where(
        and(
          eq(claims.releaseId, releaseId),
          inArray(claims.id, uniqueClaimIds),
        ),
      );
    if (matchingClaims.length !== uniqueClaimIds.length) {
      throw new HttpError(
        400,
        "Every linked claim must belong to this release.",
        "invalid_claim_link",
      );
    }
    const capturedAt = input.capturedAt || new Date();
    const snapshot = {
      sourceType: "manual",
      summary: input.summary,
      relation: input.relation,
      evidenceKind: input.evidenceKind,
      sourceUrl: input.sourceUrl || null,
      sourceReference: input.sourceReference || null,
      authorName: input.authorName || null,
      capturedAt: capturedAt.toISOString(),
    };
    const record = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(evidence)
        .values({
          releaseId,
          sourceType: "manual",
          externalReference: input.sourceReference || null,
          sourceUrl: input.sourceUrl || null,
          payloadSnapshot: snapshot,
          summary: input.summary,
          authorName: input.authorName || null,
          sourceMetadata: {},
          relation: input.relation,
          evidenceKind: input.evidenceKind,
          contentHash: contentHash(snapshot),
          capturedAt,
          authoredBy: user.userId,
        })
        .returning();
      await tx.insert(claimEvidenceLinks).values(
        uniqueClaimIds.map((claimId) => ({
          claimId,
          evidenceId: created.id,
          linkedBy: user.userId,
        })),
      );
      await appendAuditEvent(tx, {
        workspaceId: membership.workspaceId,
        actorId: user.userId,
        actorRole: membership.role,
        action: "evidence.created",
        targetType: "evidence",
        targetId: created.id,
        metadata: {
          releaseId,
          claimIds: uniqueClaimIds,
          contentHash: created.contentHash,
        },
      });
      return created;
    });
    return jsonResponse({ evidence: record }, { status: 201 });
  });
}
