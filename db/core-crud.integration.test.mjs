import { describe, expect, it } from "vitest";

import { POST as register } from "../app/api/auth/register/route.js";
import {
  GET as getProjects,
  POST as createProject,
} from "../app/api/workspaces/[workspaceId]/projects/route.js";
import {
  GET as getReleases,
  POST as createRelease,
} from "../app/api/projects/[projectId]/releases/route.js";
import { GET as getRelease } from "../app/api/releases/[releaseId]/route.js";
import { POST as createClaim } from "../app/api/releases/[releaseId]/claims/route.js";
import { POST as createEvidence } from "../app/api/releases/[releaseId]/evidence/route.js";
import { POST as createWorkspace } from "../app/api/workspaces/route.js";

const origin = "http://localhost:3000";

function request(path, { method = "GET", marker, body, cookie } = {}) {
  const headers = new Headers();
  if (body !== undefined) headers.set("content-type", "application/json");
  if (marker) headers.set("x-release-truth-request", marker);
  if (cookie) headers.set("cookie", cookie);
  if (method !== "GET") {
    headers.set("origin", origin);
    headers.set("sec-fetch-site", "same-origin");
  }
  return new Request(`${origin}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function json(response) {
  return { response, body: await response.json() };
}

async function user(email, ip) {
  const result = await json(
    await register(
      new Request(`${origin}/api/auth/register`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin,
          "sec-fetch-site": "same-origin",
          "x-release-truth-request": "auth-register",
          "cf-connecting-ip": ip,
        },
        body: JSON.stringify({
          email,
          displayName: email.split("@")[0],
          password: "correct horse battery staple",
        }),
      }),
    ),
  );
  expect(result.response.status).toBe(201);
  return {
    ...result.body.user,
    cookie: result.response.headers.get("set-cookie").split(";")[0],
  };
}

describe("project, release, claim, and evidence CRUD", () => {
  it("persists a complete manual release slice and enforces workspace isolation", async () => {
    const owner = await user("crud-owner@example.test", "198.51.100.70");
    const outsider = await user("crud-outsider@example.test", "198.51.100.71");
    const workspaceResult = await json(
      await createWorkspace(
        request("/api/workspaces", {
          method: "POST",
          marker: "workspace-create",
          cookie: owner.cookie,
          body: { name: "CRUD team", slug: "crud-team" },
        }),
      ),
    );
    const workspaceId = workspaceResult.body.workspace.id;
    const projectResult = await json(
      await createProject(
        request(`/api/workspaces/${workspaceId}/projects`, {
          method: "POST",
          marker: "project-create",
          cookie: owner.cookie,
          body: { name: "Payments", description: "Production payment service" },
        }),
        { params: Promise.resolve({ workspaceId }) },
      ),
    );
    expect(projectResult.response.status).toBe(201);
    const projectId = projectResult.body.project.id;

    const releaseResult = await json(
      await createRelease(
        request(`/api/projects/${projectId}/releases`, {
          method: "POST",
          marker: "release-create",
          cookie: owner.cookie,
          body: {
            name: "1.0.0",
            description: "First guarded release",
            targetType: "tag",
            targetValue: "v1.0.0",
          },
        }),
        { params: Promise.resolve({ projectId }) },
      ),
    );
    expect(releaseResult.response.status).toBe(201);
    const releaseId = releaseResult.body.release.id;

    const claimResult = await json(
      await createClaim(
        request(`/api/releases/${releaseId}/claims`, {
          method: "POST",
          marker: "claim-create",
          cookie: owner.cookie,
          body: {
            title: "Checkout is idempotent",
            description: "Duplicate requests do not charge twice.",
            acceptanceCriteria: "The same idempotency key returns one charge.",
            material: true,
            requiredEvidenceKinds: ["code", "test"],
          },
        }),
        { params: Promise.resolve({ releaseId }) },
      ),
    );
    expect(claimResult.response.status).toBe(201);

    const evidenceResult = await json(
      await createEvidence(
        request(`/api/releases/${releaseId}/evidence`, {
          method: "POST",
          marker: "evidence-create",
          cookie: owner.cookie,
          body: {
            summary: "Integration test verifies duplicate payment requests.",
            relation: "supports",
            evidenceKind: "test",
            sourceReference: "payments/idempotency.test.ts",
            claimIds: [claimResult.body.claim.id],
          },
        }),
        { params: Promise.resolve({ releaseId }) },
      ),
    );
    expect(evidenceResult.response.status).toBe(201);

    const releaseView = await json(
      await getRelease(request(`/api/releases/${releaseId}`, { cookie: owner.cookie }), {
        params: Promise.resolve({ releaseId }),
      }),
    );
    expect(releaseView.response.status).toBe(200);
    expect(releaseView.body.release.workspace.id).toBe(workspaceId);
    expect(releaseView.body.activeClaims).toHaveLength(1);
    expect(releaseView.body.activeEvidence).toHaveLength(1);
    expect(releaseView.body.links).toContainEqual(
      expect.objectContaining({
        claimId: claimResult.body.claim.id,
        evidenceId: evidenceResult.body.evidence.id,
      }),
    );
    expect(
      releaseView.body.auditEvents.map((event) => event.action),
    ).toEqual(
      expect.arrayContaining([
        "project.created",
        "release.created",
        "claim.created",
        "evidence.created",
      ]),
    );

    const outsiderProjects = await getProjects(
      request(`/api/workspaces/${workspaceId}/projects`, {
        cookie: outsider.cookie,
      }),
      { params: Promise.resolve({ workspaceId }) },
    );
    expect(outsiderProjects.status).toBe(404);

    const outsiderRelease = await getRelease(
      request(`/api/releases/${releaseId}`, { cookie: outsider.cookie }),
      { params: Promise.resolve({ releaseId }) },
    );
    expect(outsiderRelease.status).toBe(404);

    const projects = await json(
      await getProjects(
        request(`/api/workspaces/${workspaceId}/projects`, {
          cookie: owner.cookie,
        }),
        { params: Promise.resolve({ workspaceId }) },
      ),
    );
    const releases = await json(
      await getReleases(
        request(`/api/projects/${projectId}/releases`, {
          cookie: owner.cookie,
        }),
        { params: Promise.resolve({ projectId }) },
      ),
    );
    expect(projects.body.projects).toHaveLength(1);
    expect(releases.body.releases).toHaveLength(1);
  });
});

