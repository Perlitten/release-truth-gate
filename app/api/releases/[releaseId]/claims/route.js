import { eq } from "drizzle-orm";
import { z } from "zod";

import { jsonResponse } from "../../../../../api/security.mjs";
import { claims } from "../../../../../db/schema.js";
import { appendAuditEvent } from "../../../../../src/server/audit.js";
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

const claimSchema = z.object({
  title: z.string().trim().min(2).max(240),
  description: z.string().trim().min(2).max(12_000),
  acceptanceCriteria: z.string().trim().min(2).max(12_000),
  material: z.boolean().default(true),
  requiredEvidenceKinds: z
    .array(z.string().trim().min(1).max(64))
    .min(1)
    .max(12)
    .transform((items) => [...new Set(items)]),
  sourceReference: z.string().trim().max(500).nullable().optional(),
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
      .from(claims)
      .where(eq(claims.releaseId, releaseId))
      .orderBy(claims.createdAt);
    return jsonResponse({
      claims: rows,
      activeClaims: activeAppendOnlyRecords(rows),
      membership,
    });
  });
}

export async function POST(request, { params }) {
  return databaseRoute(async ({ db }) => {
    requireSameOriginMutation(request, "claim-create");
    const user = await requireAuthenticatedUser(db, request);
    const { releaseId } = await params;
    const membership = await requireReleaseCapability(db, {
      releaseId,
      userId: user.userId,
      capability: "create_claim",
    });
    const input = await parseJsonBody(request, claimSchema, 32_768);
    const snapshot = {
      sourceType: "manual",
      title: input.title,
      description: input.description,
      acceptanceCriteria: input.acceptanceCriteria,
      material: input.material,
      requiredEvidenceKinds: input.requiredEvidenceKinds,
      sourceReference: input.sourceReference || null,
    };
    const claim = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(claims)
        .values({
          releaseId,
          sourceType: "manual",
          title: input.title,
          description: input.description,
          acceptanceCriteria: input.acceptanceCriteria,
          sourceReference: input.sourceReference || null,
          payloadSnapshot: snapshot,
          material: input.material,
          requiredEvidenceKinds: input.requiredEvidenceKinds,
          contentHash: contentHash(snapshot),
          authoredBy: user.userId,
        })
        .returning();
      await appendAuditEvent(tx, {
        workspaceId: membership.workspaceId,
        actorId: user.userId,
        actorRole: membership.role,
        action: "claim.created",
        targetType: "claim",
        targetId: created.id,
        metadata: { releaseId, contentHash: created.contentHash },
      });
      return created;
    });
    return jsonResponse({ claim }, { status: 201 });
  });
}

