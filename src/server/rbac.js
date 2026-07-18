import { and, eq } from "drizzle-orm";

import {
  memberships,
  projects,
  releases,
  workspaces,
} from "../../db/schema.js";
import { HttpError } from "./errors.js";

export const CAPABILITIES = Object.freeze({
  owner: new Set([
    "view",
    "manage_workspace",
    "manage_members",
    "manage_integrations",
    "create_project",
    "manage_release",
    "create_claim",
    "create_evidence",
    "create_decision",
    "run_verdict",
    "generate_export",
  ]),
  admin: new Set([
    "view",
    "manage_members",
    "manage_integrations",
    "create_project",
    "manage_release",
    "create_claim",
    "create_evidence",
    "create_decision",
    "run_verdict",
    "generate_export",
  ]),
  contributor: new Set([
    "view",
    "create_project",
    "manage_release",
    "create_claim",
    "create_evidence",
    "run_verdict",
    "generate_export",
  ]),
  reviewer: new Set([
    "view",
    "create_decision",
    "run_verdict",
    "generate_export",
  ]),
  viewer: new Set(["view", "generate_export"]),
});

export function roleCan(role, capability) {
  return CAPABILITIES[role]?.has(capability) || false;
}

export async function requireWorkspaceCapability(
  db,
  { workspaceId, userId, capability },
) {
  const [membership] = await db
    .select({
      workspaceId: workspaces.id,
      workspaceName: workspaces.name,
      workspaceSlug: workspaces.slug,
      role: memberships.role,
    })
    .from(memberships)
    .innerJoin(workspaces, eq(workspaces.id, memberships.workspaceId))
    .where(
      and(
        eq(memberships.workspaceId, workspaceId),
        eq(memberships.userId, userId),
      ),
    )
    .limit(1);

  if (!membership) {
    throw new HttpError(404, "Workspace not found.", "workspace_not_found");
  }
  if (!roleCan(membership.role, capability)) {
    throw new HttpError(
      403,
      "Your workspace role does not allow this action.",
      "forbidden",
    );
  }
  return membership;
}

export async function requireProjectCapability(
  db,
  { projectId, userId, capability },
) {
  const [resource] = await db
    .select({ workspaceId: projects.workspaceId })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  if (!resource) {
    throw new HttpError(404, "Project not found.", "project_not_found");
  }
  const membership = await requireWorkspaceCapability(db, {
    workspaceId: resource.workspaceId,
    userId,
    capability,
  });
  return { ...membership, projectId };
}

export async function requireReleaseCapability(
  db,
  { releaseId, userId, capability },
) {
  const [resource] = await db
    .select({
      projectId: releases.projectId,
      workspaceId: projects.workspaceId,
    })
    .from(releases)
    .innerJoin(projects, eq(projects.id, releases.projectId))
    .where(eq(releases.id, releaseId))
    .limit(1);
  if (!resource) {
    throw new HttpError(404, "Release not found.", "release_not_found");
  }
  const membership = await requireWorkspaceCapability(db, {
    workspaceId: resource.workspaceId,
    userId,
    capability,
  });
  return { ...membership, ...resource, releaseId };
}

