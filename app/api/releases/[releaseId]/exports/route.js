import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { jsonResponse } from "../../../../../api/security.mjs";
import {
  exportArtifacts,
  projects,
  releases,
  verdictRuns,
  workspaces,
} from "../../../../../db/schema.js";
import { appendAuditEvent } from "../../../../../src/server/audit.js";
import {
  databaseRoute,
  parseJsonBody,
  requireAuthenticatedUser,
  requireSameOriginMutation,
} from "../../../../../src/server/http.js";
import { HttpError } from "../../../../../src/server/errors.js";
import { requireReleaseCapability } from "../../../../../src/server/rbac.js";
import {
  EXPORT_FORMAT_VERSION,
  signExportManifest,
} from "../../../../../src/server/signed-export.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const requestSchema = z
  .object({ verdictRunId: z.string().uuid().optional() })
  .strict();

function envelope(artifact) {
  return {
    formatVersion: artifact.formatVersion,
    manifest: artifact.manifest,
    artifactHash: artifact.artifactHash,
    signatureAlgorithm: artifact.signatureAlgorithm,
    publicKeyId: artifact.publicKeyId,
    signature: artifact.signature,
  };
}

export async function GET(request, { params }) {
  return databaseRoute(async ({ db }) => {
    const user = await requireAuthenticatedUser(db, request);
    const { releaseId } = await params;
    await requireReleaseCapability(db, {
      releaseId,
      userId: user.userId,
      capability: "view",
    });
    const artifacts = await db
      .select({
        id: exportArtifacts.id,
        verdictRunId: exportArtifacts.verdictRunId,
        formatVersion: exportArtifacts.formatVersion,
        artifactHash: exportArtifacts.artifactHash,
        signatureAlgorithm: exportArtifacts.signatureAlgorithm,
        publicKeyId: exportArtifacts.publicKeyId,
        createdAt: exportArtifacts.createdAt,
      })
      .from(exportArtifacts)
      .where(eq(exportArtifacts.releaseId, releaseId))
      .orderBy(desc(exportArtifacts.createdAt));
    return jsonResponse({ artifacts });
  });
}

export async function POST(request, { params }) {
  return databaseRoute(async ({ db }) => {
    requireSameOriginMutation(request, "export-generate");
    const user = await requireAuthenticatedUser(db, request);
    const { releaseId } = await params;
    const membership = await requireReleaseCapability(db, {
      releaseId,
      userId: user.userId,
      capability: "generate_export",
    });
    const input = await parseJsonBody(request, requestSchema, 2_048);
    const [resource] = await db
      .select({
        release: {
          id: releases.id,
          name: releases.name,
          description: releases.description,
          status: releases.status,
          targetType: releases.targetType,
          targetValue: releases.targetValue,
          createdAt: releases.createdAt,
          finalizedAt: releases.finalizedAt,
        },
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
    const [run] = await db
      .select()
      .from(verdictRuns)
      .where(
        input.verdictRunId
          ? and(
              eq(verdictRuns.releaseId, releaseId),
              eq(verdictRuns.id, input.verdictRunId),
            )
          : eq(verdictRuns.releaseId, releaseId),
      )
      .orderBy(desc(verdictRuns.createdAt))
      .limit(1);
    if (!run) {
      throw new HttpError(
        409,
        "A stored verdict run is required before export.",
        "verdict_run_required",
      );
    }

    const manifest = {
      formatVersion: EXPORT_FORMAT_VERSION,
      product: "Release Truth Evidence Gate",
      workspace: resource.workspace,
      project: resource.project,
      release: resource.release,
      verdictRun: {
        id: run.id,
        engineVersion: run.engineVersion,
        policyVersion: run.policyVersion,
        inputSnapshot: run.inputSnapshot,
        inputDigest: run.inputDigest,
        result: run.result,
        reasonCodes: run.reasonCodes,
        createdAt: run.createdAt,
      },
    };
    const signed = signExportManifest(manifest);
    const artifact = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(exportArtifacts)
        .values({
          releaseId,
          verdictRunId: run.id,
          formatVersion: EXPORT_FORMAT_VERSION,
          manifest,
          artifactHash: signed.artifactHash,
          signatureAlgorithm: signed.signatureAlgorithm,
          publicKeyId: signed.publicKeyId,
          signature: signed.signature,
          generatedBy: user.userId,
        })
        .returning();
      await appendAuditEvent(tx, {
        workspaceId: membership.workspaceId,
        actorId: user.userId,
        actorRole: membership.role,
        action: "export.generated",
        targetType: "export_artifact",
        targetId: created.id,
        metadata: {
          releaseId,
          verdictRunId: run.id,
          artifactHash: signed.artifactHash,
          publicKeyId: signed.publicKeyId,
        },
      });
      return created;
    });
    return jsonResponse(
      { artifact: { id: artifact.id, createdAt: artifact.createdAt }, export: envelope(artifact) },
      { status: 201 },
    );
  });
}
