import { eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";

import { jsonResponse } from "../../../../api/security.mjs";
import {
  auditEvents,
  claimEvidenceLinks,
  claims,
  decisions,
  evidence,
  projects,
  releases,
  users,
  verdictRuns,
  workspaces,
} from "../../../../db/schema.js";
import { appendAuditEvent } from "../../../../src/server/audit.js";
import {
  databaseRoute,
  parseJsonBody,
  requireAuthenticatedUser,
  requireSameOriginMutation,
} from "../../../../src/server/http.js";
import { activeAppendOnlyRecords } from "../../../../src/server/immutable-records.js";
import { requireReleaseCapability } from "../../../../src/server/rbac.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const updateSchema = z
  .object({
    name: z.string().trim().min(1).max(160).optional(),
    description: z.string().trim().max(4_000).optional(),
    status: z.enum(["draft", "in_review", "finalized", "archived"]).optional(),
    targetType: z
      .enum(["branch", "tag", "commit", "unspecified"])
      .optional(),
    targetValue: z.string().trim().max(255).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0);

export async function GET(request, { params }) {
  return databaseRoute(async ({ db }) => {
    const user = await requireAuthenticatedUser(db, request);
    const { releaseId } = await params;
    const membership = await requireReleaseCapability(db, {
      releaseId,
      userId: user.userId,
      capability: "view",
    });
    const [release] = await db
      .select({
        id: releases.id,
        name: releases.name,
        description: releases.description,
        status: releases.status,
        targetType: releases.targetType,
        targetValue: releases.targetValue,
        finalizedAt: releases.finalizedAt,
        createdAt: releases.createdAt,
        updatedAt: releases.updatedAt,
        project: {
          id: projects.id,
          name: projects.name,
          description: projects.description,
        },
        workspace: {
          id: workspaces.id,
          name: workspaces.name,
          slug: workspaces.slug,
        },
      })
      .from(releases)
      .innerJoin(projects, eq(projects.id, releases.projectId))
      .innerJoin(workspaces, eq(workspaces.id, projects.workspaceId))
      .where(eq(releases.id, releaseId))
      .limit(1);
    const claimRows = await db
      .select()
      .from(claims)
      .where(eq(claims.releaseId, releaseId));
    const evidenceRows = await db
      .select()
      .from(evidence)
      .where(eq(evidence.releaseId, releaseId));
    const links = await db
      .select({
        claimId: claimEvidenceLinks.claimId,
        evidenceId: claimEvidenceLinks.evidenceId,
        createdAt: claimEvidenceLinks.createdAt,
      })
      .from(claimEvidenceLinks)
      .innerJoin(claims, eq(claims.id, claimEvidenceLinks.claimId))
      .where(eq(claims.releaseId, releaseId));
    const assignees = alias(users, "assignees");
    const decisionRows = await db
      .select({
        id: decisions.id,
        releaseId: decisions.releaseId,
        claimId: decisions.claimId,
        verdictRunId: decisions.verdictRunId,
        type: decisions.type,
        status: decisions.status,
        rationale: decisions.rationale,
        assigneeId: decisions.assigneeId,
        roleAtDecision: decisions.roleAtDecision,
        basedOnEvidenceIds: decisions.basedOnEvidenceIds,
        recordAction: decisions.recordAction,
        supersedesId: decisions.supersedesId,
        correctionReason: decisions.correctionReason,
        contentHash: decisions.contentHash,
        createdAt: decisions.createdAt,
        actor: {
          id: users.id,
          displayName: users.displayName,
        },
        assignee: {
          id: assignees.id,
          displayName: assignees.displayName,
        },
      })
      .from(decisions)
      .innerJoin(users, eq(users.id, decisions.authoredBy))
      .leftJoin(assignees, eq(assignees.id, decisions.assigneeId))
      .where(eq(decisions.releaseId, releaseId))
      .orderBy(decisions.createdAt);
    const runRows = await db
      .select()
      .from(verdictRuns)
      .where(eq(verdictRuns.releaseId, releaseId))
      .orderBy(verdictRuns.createdAt);
    const eventRows = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.workspaceId, membership.workspaceId))
      .orderBy(auditEvents.createdAt);
    return jsonResponse({
      release,
      membership,
      claims: claimRows,
      activeClaims: activeAppendOnlyRecords(claimRows),
      evidence: evidenceRows,
      activeEvidence: activeAppendOnlyRecords(evidenceRows),
      links,
      decisions: decisionRows,
      activeDecisions: activeAppendOnlyRecords(decisionRows),
      verdictRuns: runRows,
      auditEvents: eventRows.filter(
        (event) =>
          event.targetId === releaseId ||
          event.metadata?.releaseId === releaseId ||
          event.targetId === release.project.id,
      ),
    });
  });
}

export async function PATCH(request, { params }) {
  return databaseRoute(async ({ db }) => {
    requireSameOriginMutation(request, "release-update");
    const user = await requireAuthenticatedUser(db, request);
    const { releaseId } = await params;
    const membership = await requireReleaseCapability(db, {
      releaseId,
      userId: user.userId,
      capability: "manage_release",
    });
    const input = await parseJsonBody(request, updateSchema, 8_192);
    const [current] = await db
      .select()
      .from(releases)
      .where(eq(releases.id, releaseId))
      .limit(1);
    const targetType = input.targetType ?? current.targetType;
    const targetValue =
      input.targetValue !== undefined ? input.targetValue : current.targetValue;
    if (targetType === "unspecified" && targetValue) {
      throw new z.ZodError([
        {
          code: "custom",
          path: ["targetValue"],
          message: "Unspecified targets cannot have a value.",
        },
      ]);
    }
    if (targetType !== "unspecified" && !targetValue) {
      throw new z.ZodError([
        {
          code: "custom",
          path: ["targetValue"],
          message: "A release target value is required.",
        },
      ]);
    }
    const values = {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined
        ? { description: input.description }
        : {}),
      ...(input.status !== undefined
        ? {
            status: input.status,
            finalizedAt:
              input.status === "finalized" ? new Date() : current.finalizedAt,
            finalizedBy:
              input.status === "finalized" ? user.userId : current.finalizedBy,
          }
        : {}),
      ...(input.targetType !== undefined ? { targetType } : {}),
      ...(input.targetValue !== undefined
        ? { targetValue: targetType === "unspecified" ? null : targetValue }
        : {}),
      updatedAt: new Date(),
    };
    const release = await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(releases)
        .set(values)
        .where(eq(releases.id, releaseId))
        .returning();
      await appendAuditEvent(tx, {
        workspaceId: membership.workspaceId,
        actorId: user.userId,
        actorRole: membership.role,
        action:
          input.status && input.status !== current.status
            ? `release.${input.status}`
            : "release.updated",
        targetType: "release",
        targetId: releaseId,
        metadata: { fields: Object.keys(input), releaseId },
      });
      return updated;
    });
    return jsonResponse({ release });
  });
}
