import { describe, expect, it } from "vitest";

import { POST as register } from "../app/api/auth/register/route.js";
import { POST as createWorkspace } from "../app/api/workspaces/route.js";
import { POST as createProject } from "../app/api/workspaces/[workspaceId]/projects/route.js";
import { POST as createRelease } from "../app/api/projects/[projectId]/releases/route.js";
import { POST as createClaim } from "../app/api/releases/[releaseId]/claims/route.js";
import { POST as createEvidence } from "../app/api/releases/[releaseId]/evidence/route.js";
import { POST as createDecision } from "../app/api/releases/[releaseId]/decisions/route.js";
import { POST as runVerdict } from "../app/api/releases/[releaseId]/verdict-runs/route.js";
import { POST as createInvitation } from "../app/api/workspaces/[workspaceId]/invitations/route.js";
import { POST as acceptInvitation } from "../app/api/invitations/accept/route.js";

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

describe("append-only decisions and reproducible verdict runs", () => {
  it("moves from CONDITIONAL GO to GO only after a reviewer decision", async () => {
    const owner = await user("governance-owner@example.test", "198.51.100.80");
    const reviewer = await user("governance-reviewer@example.test", "198.51.100.81");
    const outsider = await user("governance-outsider@example.test", "198.51.100.82");
    const workspaceResult = await json(
      await createWorkspace(
        request("/api/workspaces", {
          method: "POST",
          marker: "workspace-create",
          cookie: owner.cookie,
          body: { name: "Governance team", slug: "governance-team" },
        }),
      ),
    );
    const workspaceId = workspaceResult.body.workspace.id;
    const invitationResult = await json(
      await createInvitation(
        request(`/api/workspaces/${workspaceId}/invitations`, {
          method: "POST",
          marker: "workspace-invitation",
          cookie: owner.cookie,
          body: { email: reviewer.email, role: "reviewer" },
        }),
        { params: Promise.resolve({ workspaceId }) },
      ),
    );
    const token = new URL(invitationResult.body.inviteUrl).searchParams.get("invite");
    expect(
      (
        await acceptInvitation(
          request("/api/invitations/accept", {
            method: "POST",
            marker: "invitation-accept",
            cookie: reviewer.cookie,
            body: { token },
          }),
        )
      ).status,
    ).toBe(200);

    const projectResult = await json(
      await createProject(
        request(`/api/workspaces/${workspaceId}/projects`, {
          method: "POST",
          marker: "project-create",
          cookie: owner.cookie,
          body: { name: "Governed service" },
        }),
        { params: Promise.resolve({ workspaceId }) },
      ),
    );
    const projectId = projectResult.body.project.id;
    const releaseResult = await json(
      await createRelease(
        request(`/api/projects/${projectId}/releases`, {
          method: "POST",
          marker: "release-create",
          cookie: owner.cookie,
          body: {
            name: "2.0.0",
            targetType: "tag",
            targetValue: "v2.0.0",
          },
        }),
        { params: Promise.resolve({ projectId }) },
      ),
    );
    const releaseId = releaseResult.body.release.id;
    const claimResult = await json(
      await createClaim(
        request(`/api/releases/${releaseId}/claims`, {
          method: "POST",
          marker: "claim-create",
          cookie: owner.cookie,
          body: {
            title: "Migration is reversible",
            description: "The database migration can be rolled back.",
            acceptanceCriteria: "A rollback test completes successfully.",
            material: true,
            requiredEvidenceKinds: ["test"],
          },
        }),
        { params: Promise.resolve({ releaseId }) },
      ),
    );
    const evidenceResult = await json(
      await createEvidence(
        request(`/api/releases/${releaseId}/evidence`, {
          method: "POST",
          marker: "evidence-create",
          cookie: owner.cookie,
          body: {
            summary: "Rollback integration test passed.",
            relation: "supports",
            evidenceKind: "test",
            claimIds: [claimResult.body.claim.id],
          },
        }),
        { params: Promise.resolve({ releaseId }) },
      ),
    );

    const firstRun = await json(
      await runVerdict(
        request(`/api/releases/${releaseId}/verdict-runs`, {
          method: "POST",
          marker: "verdict-run",
          cookie: owner.cookie,
          body: {},
        }),
        { params: Promise.resolve({ releaseId }) },
      ),
    );
    expect(firstRun.response.status).toBe(201);
    expect(firstRun.body.verdictRun.result.status).toBe("conditional_go");
    expect(firstRun.body.verdictRun.reasonCodes).toContain(
      "CURRENT_APPROVAL_REQUIRED",
    );

    const repeated = await json(
      await runVerdict(
        request(`/api/releases/${releaseId}/verdict-runs`, {
          method: "POST",
          marker: "verdict-run",
          cookie: owner.cookie,
          body: {},
        }),
        { params: Promise.resolve({ releaseId }) },
      ),
    );
    expect(repeated.body.reused).toBe(true);
    expect(repeated.body.verdictRun.id).toBe(firstRun.body.verdictRun.id);

    const decisionResult = await json(
      await createDecision(
        request(`/api/releases/${releaseId}/decisions`, {
          method: "POST",
          marker: "decision-create",
          cookie: reviewer.cookie,
          body: {
            claimId: claimResult.body.claim.id,
            type: "approval",
            rationale: "Rollback evidence directly satisfies the acceptance criterion.",
            basedOnEvidenceIds: [evidenceResult.body.evidence.id],
          },
        }),
        { params: Promise.resolve({ releaseId }) },
      ),
    );
    expect(decisionResult.response.status).toBe(201);
    expect(decisionResult.body.decision.roleAtDecision).toBe("reviewer");

    const approvedRun = await json(
      await runVerdict(
        request(`/api/releases/${releaseId}/verdict-runs`, {
          method: "POST",
          marker: "verdict-run",
          cookie: reviewer.cookie,
          body: {},
        }),
        { params: Promise.resolve({ releaseId }) },
      ),
    );
    expect(approvedRun.response.status).toBe(201);
    expect(approvedRun.body.verdictRun.result.status).toBe("go");
    expect(approvedRun.body.verdictRun.inputDigest).not.toBe(
      firstRun.body.verdictRun.inputDigest,
    );

    const fakeResult = await runVerdict(
      request(`/api/releases/${releaseId}/verdict-runs`, {
        method: "POST",
        marker: "verdict-run",
        cookie: owner.cookie,
        body: { result: { status: "go" } },
      }),
      { params: Promise.resolve({ releaseId }) },
    );
    expect(fakeResult.status).toBe(400);

    const outsiderRun = await runVerdict(
      request(`/api/releases/${releaseId}/verdict-runs`, {
        method: "POST",
        marker: "verdict-run",
        cookie: outsider.cookie,
        body: {},
      }),
      { params: Promise.resolve({ releaseId }) },
    );
    expect(outsiderRun.status).toBe(404);
  });
});

