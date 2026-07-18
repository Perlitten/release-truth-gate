import { describe, expect, it } from "vitest";

import { POST as acceptInvitation } from "../app/api/invitations/accept/route.js";
import { POST as login } from "../app/api/auth/login/route.js";
import { GET as getMe } from "../app/api/auth/me/route.js";
import { POST as register } from "../app/api/auth/register/route.js";
import {
  GET as getInvitations,
  POST as createInvitation,
} from "../app/api/workspaces/[workspaceId]/invitations/route.js";
import { GET as getMembers } from "../app/api/workspaces/[workspaceId]/members/route.js";
import { PATCH as changeRole } from "../app/api/workspaces/[workspaceId]/members/[userId]/route.js";
import {
  GET as getWorkspaces,
  POST as createWorkspace,
} from "../app/api/workspaces/route.js";
import { withDatabase } from "./connection.js";
import { verifyAuditChain } from "../src/server/audit.js";

const origin = "http://localhost:3000";

let clientSequence = 10;

function apiRequest(
  path,
  { method = "GET", marker, body, cookie, clientIp } = {},
) {
  const headers = new Headers();
  if (body !== undefined) headers.set("content-type", "application/json");
  if (marker) headers.set("x-release-truth-request", marker);
  if (cookie) headers.set("cookie", cookie);
  if (clientIp) headers.set("cf-connecting-ip", clientIp);
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

function cookieFrom(response) {
  return response.headers.get("set-cookie")?.split(";")[0] || null;
}

async function responseJson(response) {
  return { response, body: await response.json() };
}

async function registerUser(email, displayName) {
  clientSequence += 1;
  const result = await responseJson(
    await register(
      apiRequest("/api/auth/register", {
        method: "POST",
        marker: "auth-register",
        body: {
          email,
          displayName,
          password: "correct horse battery staple",
        },
        clientIp: `198.51.100.${clientSequence}`,
      }),
    ),
  );
  expect(result.response.status).toBe(201);
  return {
    ...result.body.user,
    cookie: cookieFrom(result.response),
  };
}

async function inviteAndAccept({
  workspaceId,
  ownerCookie,
  invitee,
  role,
}) {
  const invited = await responseJson(
    await createInvitation(
      apiRequest(`/api/workspaces/${workspaceId}/invitations`, {
        method: "POST",
        marker: "workspace-invitation",
        cookie: ownerCookie,
        body: { email: invitee.email, role },
      }),
      { params: Promise.resolve({ workspaceId }) },
    ),
  );
  expect(invited.response.status).toBe(201);
  const token = new URL(invited.body.inviteUrl).searchParams.get("invite");
  const accepted = await responseJson(
    await acceptInvitation(
      apiRequest("/api/invitations/accept", {
        method: "POST",
        marker: "invitation-accept",
        cookie: invitee.cookie,
        body: { token },
      }),
    ),
  );
  expect(accepted.response.status).toBe(200);
  return { invitation: invited.body.invitation, token };
}

describe("database identity, invitations, and RBAC", () => {
  it("supports shared workspace membership and rejects ID substitution", async () => {
    const alice = await registerUser("alice@example.test", "Alice");
    const bob = await registerUser("bob@example.test", "Bob");
    const outsider = await registerUser("outsider@example.test", "Outsider");

    const created = await responseJson(
      await createWorkspace(
        apiRequest("/api/workspaces", {
          method: "POST",
          marker: "workspace-create",
          cookie: alice.cookie,
          body: { name: "Launch team", slug: "launch-team" },
        }),
      ),
    );
    expect(created.response.status).toBe(201);
    const workspaceId = created.body.workspace.id;

    const { token } = await inviteAndAccept({
      workspaceId,
      ownerCookie: alice.cookie,
      invitee: bob,
      role: "reviewer",
    });

    const bobMe = await responseJson(
      await getMe(apiRequest("/api/auth/me", { cookie: bob.cookie })),
    );
    expect(bobMe.response.status).toBe(200);
    expect(bobMe.body.workspaces).toContainEqual(
      expect.objectContaining({ id: workspaceId, role: "reviewer" }),
    );

    const members = await responseJson(
      await getMembers(
        apiRequest(`/api/workspaces/${workspaceId}/members`, {
          cookie: bob.cookie,
        }),
        { params: Promise.resolve({ workspaceId }) },
      ),
    );
    expect(members.response.status).toBe(200);
    expect(members.body.members).toHaveLength(2);

    const outsiderAttempt = await getMembers(
      apiRequest(`/api/workspaces/${workspaceId}/members`, {
        cookie: outsider.cookie,
      }),
      { params: Promise.resolve({ workspaceId }) },
    );
    expect(outsiderAttempt.status).toBe(404);

    const replay = await acceptInvitation(
      apiRequest("/api/invitations/accept", {
        method: "POST",
        marker: "invitation-accept",
        cookie: bob.cookie,
        body: { token },
      }),
    );
    expect(replay.status).toBe(410);

    await expect(
      withDatabase((db) => verifyAuditChain(db, workspaceId), {
        connectionString: process.env.DATABASE_URL_TEST,
      }),
    ).resolves.toBe(true);
  });

  it("prevents contributors from assigning roles and admins from assigning ownership", async () => {
    const owner = await registerUser("owner-roles@example.test", "Owner");
    const contributor = await registerUser(
      "contributor@example.test",
      "Contributor",
    );
    const admin = await registerUser("admin@example.test", "Admin");
    const reviewer = await registerUser("reviewer@example.test", "Reviewer");

    const created = await responseJson(
      await createWorkspace(
        apiRequest("/api/workspaces", {
          method: "POST",
          marker: "workspace-create",
          cookie: owner.cookie,
          body: { name: "Role boundary", slug: "role-boundary" },
        }),
      ),
    );
    const workspaceId = created.body.workspace.id;
    await inviteAndAccept({
      workspaceId,
      ownerCookie: owner.cookie,
      invitee: contributor,
      role: "contributor",
    });
    await inviteAndAccept({
      workspaceId,
      ownerCookie: owner.cookie,
      invitee: admin,
      role: "admin",
    });
    await inviteAndAccept({
      workspaceId,
      ownerCookie: owner.cookie,
      invitee: reviewer,
      role: "reviewer",
    });

    const contributorAttempt = await changeRole(
      apiRequest(`/api/workspaces/${workspaceId}/members/${reviewer.id}`, {
        method: "PATCH",
        marker: "membership-role",
        cookie: contributor.cookie,
        body: { role: "admin" },
      }),
      { params: Promise.resolve({ workspaceId, userId: reviewer.id }) },
    );
    expect(contributorAttempt.status).toBe(403);

    const adminAttempt = await changeRole(
      apiRequest(`/api/workspaces/${workspaceId}/members/${reviewer.id}`, {
        method: "PATCH",
        marker: "membership-role",
        cookie: admin.cookie,
        body: { role: "owner" },
      }),
      { params: Promise.resolve({ workspaceId, userId: reviewer.id }) },
    );
    expect(adminAttempt.status).toBe(403);

    const ownerAttempt = await responseJson(
      await changeRole(
        apiRequest(`/api/workspaces/${workspaceId}/members/${reviewer.id}`, {
          method: "PATCH",
          marker: "membership-role",
          cookie: owner.cookie,
          body: { role: "admin" },
        }),
        { params: Promise.resolve({ workspaceId, userId: reviewer.id }) },
      ),
    );
    expect(ownerAttempt.response.status).toBe(200);
    expect(ownerAttempt.body.membership.role).toBe("admin");
  });

  it("rejects cross-site mutations and invalid login without leaking account existence", async () => {
    const crossSite = await createWorkspace(
      new Request(`${origin}/api/workspaces`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://attacker.example",
          "sec-fetch-site": "cross-site",
          "x-release-truth-request": "workspace-create",
        },
        body: JSON.stringify({ name: "Bad", slug: "bad-workspace" }),
      }),
    );
    expect(crossSite.status).toBe(403);

    const invalid = await responseJson(
      await login(
        apiRequest("/api/auth/login", {
          method: "POST",
          marker: "auth-login",
          body: {
            email: "missing@example.test",
            password: "not-the-right-password",
          },
        }),
      ),
    );
    expect(invalid.response.status).toBe(401);
    expect(invalid.body.error).toBe("Email or password is invalid.");
  });
});
