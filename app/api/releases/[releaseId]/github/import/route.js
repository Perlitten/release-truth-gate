import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { consumeRateLimit, jsonResponse } from "../../../../../../api/security.mjs";
import {
  claimEvidenceLinks,
  claims,
  evidence,
  githubInstallations,
  integrationImports,
  projectRepositories,
  releases,
} from "../../../../../../db/schema.js";
import { appendAuditEvent } from "../../../../../../src/server/audit.js";
import { HttpError } from "../../../../../../src/server/errors.js";
import {
  fetchGitHubImportObject,
} from "../../../../../../src/server/github-app.js";
import {
  githubExternalId,
  githubSummary,
  normalizeGitHubObject,
} from "../../../../../../src/server/github-import.js";
import {
  databaseRoute,
  parseJsonBody,
  requireAuthenticatedUser,
  requireSameOriginMutation,
} from "../../../../../../src/server/http.js";
import { contentHash } from "../../../../../../src/server/immutable-records.js";
import { requireReleaseCapability } from "../../../../../../src/server/rbac.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const importSchema = z
  .object({
    projectRepositoryId: z.string().uuid(),
    objectType: z.enum([
      "issue",
      "pull_request",
      "commit",
      "check_run",
      "status",
    ]),
    reference: z.string().trim().min(1).max(255),
    claimIds: z.array(z.string().uuid()).max(100).default([]),
    relation: z.enum(["supports", "contradicts", "missing"]).default("supports"),
    evidenceKind: z.string().trim().min(1).max(80).default("github"),
    material: z.boolean().default(true),
  })
  .strict();

const sourceTypes = {
  pull_request: "github_pull_request",
  commit: "github_commit",
  check_run: "github_check_run",
  status: "github_status",
};

export async function POST(request, { params }) {
  return databaseRoute(async ({ db }) => {
    requireSameOriginMutation(request, "github-import");
    const rate = consumeRateLimit(request, {
      bucket: "github-import",
      limit: 30,
      windowMs: 10 * 60 * 1000,
    });
    if (!rate.allowed) {
      throw new HttpError(429, "Too many GitHub imports.", "rate_limited");
    }
    const user = await requireAuthenticatedUser(db, request);
    const { releaseId } = await params;
    const membership = await requireReleaseCapability(db, {
      releaseId,
      userId: user.userId,
      capability: "create_evidence",
    });
    const input = await parseJsonBody(request, importSchema, 16_384);
    const [source] = await db
      .select({
        repository: projectRepositories,
        installation: githubInstallations,
        releaseProjectId: releases.projectId,
      })
      .from(projectRepositories)
      .innerJoin(
        githubInstallations,
        eq(githubInstallations.id, projectRepositories.githubInstallationId),
      )
      .innerJoin(releases, eq(releases.id, releaseId))
      .where(eq(projectRepositories.id, input.projectRepositoryId))
      .limit(1);
    if (
      !source ||
      source.repository.projectId !== source.releaseProjectId ||
      source.installation.workspaceId !== membership.workspaceId ||
      source.installation.status !== "active" ||
      !source.repository.active
    ) {
      throw new HttpError(404, "Linked GitHub repository not found.", "github_repository_not_found");
    }
    if (input.objectType === "issue" && input.claimIds.length) {
      throw new HttpError(400, "Issue claims cannot be linked as evidence.", "github_import_invalid");
    }
    if (input.objectType !== "issue" && input.claimIds.length) {
      const linkedClaims = await db
        .select({ id: claims.id })
        .from(claims)
        .where(
          and(
            eq(claims.releaseId, releaseId),
            inArray(claims.id, input.claimIds),
          ),
        );
      if (linkedClaims.length !== new Set(input.claimIds).size) {
        throw new HttpError(400, "Every linked claim must belong to this release.", "claim_link_invalid");
      }
    }

    const raw = await fetchGitHubImportObject({
      installationId: source.installation.installationId,
      owner: source.repository.ownerLogin,
      repository: source.repository.repositoryName,
      objectType: input.objectType,
      reference: input.reference,
    });
    const normalized = normalizeGitHubObject(input.objectType, raw);
    const externalId = githubExternalId(input.objectType, normalized);
    const payloadHash = contentHash(normalized);
    const [exact] = await db
      .select()
      .from(integrationImports)
      .where(
        and(
          eq(integrationImports.projectRepositoryId, source.repository.id),
          eq(integrationImports.objectType, input.objectType),
          eq(integrationImports.externalId, externalId),
          eq(integrationImports.payloadHash, payloadHash),
        ),
      )
      .limit(1);
    if (exact) return jsonResponse({ integrationImport: exact, reused: true });
    const [previous] = await db
      .select()
      .from(integrationImports)
      .where(
        and(
          eq(integrationImports.projectRepositoryId, source.repository.id),
          eq(integrationImports.releaseId, releaseId),
          eq(integrationImports.objectType, input.objectType),
          eq(integrationImports.externalId, externalId),
        ),
      )
      .orderBy(desc(integrationImports.importedAt))
      .limit(1);
    const externalUrl =
      normalized.url ||
      `https://github.com/${source.repository.ownerLogin}/${source.repository.repositoryName}`;
    const recordAction = previous ? "correction" : "snapshot";
    const correctionReason = previous
      ? "GitHub source changed since the previous import."
      : null;
    const capturedAt = new Date(
      normalized.updatedAt ||
        normalized.completedAt ||
        normalized.committer?.git?.date ||
        Date.now(),
    );

    const result = await db.transaction(async (tx) => {
      let importedClaim = null;
      let importedEvidence = null;
      if (input.objectType === "issue") {
        const record = {
          releaseId,
          sourceType: "github_issue",
          title: normalized.title,
          description: normalized.body || "",
          acceptanceCriteria: normalized.body || normalized.title,
          sourceReference: `${source.repository.ownerLogin}/${source.repository.repositoryName}#${normalized.number}`,
          externalUrl,
          externalReference: externalId,
          payloadSnapshot: normalized,
          material: input.material,
          requiredEvidenceKinds: [],
          recordAction,
          supersedesId: previous?.importedClaimId || null,
          correctionReason,
          authoredBy: user.userId,
          capturedAt,
        };
        [importedClaim] = await tx
          .insert(claims)
          .values({ ...record, contentHash: contentHash(record) })
          .returning();
      } else {
        const record = {
          releaseId,
          sourceType: sourceTypes[input.objectType],
          externalReference: externalId,
          sourceUrl: externalUrl,
          payloadSnapshot: normalized,
          summary: githubSummary(input.objectType, normalized),
          authorName:
            normalized.author?.github?.login ||
            normalized.author?.login ||
            normalized.app?.name ||
            "GitHub",
          sourceMetadata: {
            repositoryId: source.repository.repositoryId,
            repository: `${source.repository.ownerLogin}/${source.repository.repositoryName}`,
            objectType: input.objectType,
          },
          relation: input.relation,
          evidenceKind: input.evidenceKind,
          recordAction,
          supersedesId: previous?.importedEvidenceId || null,
          correctionReason,
          capturedAt,
          authoredBy: user.userId,
        };
        [importedEvidence] = await tx
          .insert(evidence)
          .values({ ...record, contentHash: contentHash(record) })
          .returning();
        if (input.claimIds.length) {
          await tx.insert(claimEvidenceLinks).values(
            input.claimIds.map((claimId) => ({
              claimId,
              evidenceId: importedEvidence.id,
              linkedBy: user.userId,
            })),
          );
        }
      }
      const [createdImport] = await tx
        .insert(integrationImports)
        .values({
          projectRepositoryId: source.repository.id,
          releaseId,
          objectType: input.objectType,
          externalId,
          externalUrl,
          normalizedPayload: normalized,
          payloadHash,
          importedClaimId: importedClaim?.id || null,
          importedEvidenceId: importedEvidence?.id || null,
          importedBy: user.userId,
        })
        .returning();
      await appendAuditEvent(tx, {
        workspaceId: membership.workspaceId,
        actorId: user.userId,
        actorRole: membership.role,
        action: previous ? "github.object_reimported" : "github.object_imported",
        targetType: "integration_import",
        targetId: createdImport.id,
        metadata: {
          releaseId,
          projectRepositoryId: source.repository.id,
          objectType: input.objectType,
          externalId,
          payloadHash,
          importedClaimId: importedClaim?.id || null,
          importedEvidenceId: importedEvidence?.id || null,
        },
      });
      return {
        integrationImport: createdImport,
        claim: importedClaim,
        evidence: importedEvidence,
      };
    });
    return jsonResponse({ ...result, reused: false }, { status: 201 });
  });
}
