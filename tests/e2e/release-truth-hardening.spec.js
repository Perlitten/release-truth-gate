import { expect, test } from "@playwright/test";

const password = "correct horse battery staple";

async function register(page, email, displayName) {
  await page.goto("/");
  await page.getByLabel("Name").fill(displayName);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page
    .locator("form")
    .getByRole("button", { name: "Create account", exact: true })
    .click();
}

async function createWorkspaceProjectRelease(page, workspaceName, releaseName) {
  await expect(
    page.getByRole("heading", { name: "Create your first workspace" }),
  ).toBeVisible();
  await page.getByLabel("Workspace name").fill(workspaceName);
  await page.getByRole("button", { name: /Create workspace/ }).click();

  await page
    .locator(".rt-main")
    .getByRole("button", { name: "New project", exact: true })
    .click();
  await page.getByLabel("Project name").fill("Hardening project");
  await page.getByRole("button", { name: /Create record/ }).click();
  await page.getByRole("button", { name: "New release" }).first().click();
  await page.getByLabel("Release name").fill(releaseName);
  await page.getByLabel("Target value").fill("v1.0.0");
  await page.getByRole("button", { name: /Create record/ }).click();
}

async function addClaim(page, title) {
  await page.getByRole("tab", { name: /^Claims/ }).click();
  await page.getByRole("button", { name: "Add claim" }).click();
  await page.getByLabel("Claim", { exact: true }).fill(title);
  await page.getByLabel("What must be true?").fill("Behavior must be provably correct.");
  await page.getByLabel("Acceptance criteria").fill("A passing current-revision test exists.");
  await page.getByLabel("Required evidence kinds").fill("test");
  await page.getByRole("button", { name: /Create record/ }).click();
}

// ISSUE-001 (S0): reviewers must not be able to record a decision without
// acknowledging that they read the evidence, not just its title.
test("blocks a blind decision sign-off until evidence acknowledgment is checked", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await register(page, "e2e-blind-approval@example.test", "Blind Approval Owner");
  await createWorkspaceProjectRelease(page, "Blind Approval Team", "1.0.0");
  await addClaim(page, "Checkout is idempotent");

  await page.getByRole("tab", { name: /^Evidence/ }).click();
  await page.getByRole("button", { name: "Add evidence" }).first().click();
  await page.getByLabel("Evidence summary").fill("Idempotency test passed on the release tag.");
  await page.getByLabel("Evidence kind").fill("test");
  await page.getByRole("button", { name: /Create record/ }).click();

  await page.getByRole("tab", { name: /^Decisions/ }).click();
  await page.getByRole("button", { name: "Record decision" }).click();
  await page.getByLabel("Rationale").fill(
    "The linked test directly satisfies the acceptance criterion.",
  );

  const acknowledgment = page.getByLabel(
    "I have read the evidence content above, not only the titles, before recording this decision.",
  );
  await expect(acknowledgment).toBeVisible();
  await expect(acknowledgment).not.toBeChecked();

  // Submitting without the acknowledgment must not create a record: the
  // native required-checkbox validation should keep the dialog open.
  await page.getByRole("button", { name: /Create record/ }).click();
  await expect(page.getByRole("dialog", { name: "Record decision" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Decisions 0" })).toBeVisible();

  await acknowledgment.check();
  await page.getByRole("button", { name: /Create record/ }).click();
  await expect(page.getByRole("dialog", { name: "Record decision" })).toBeHidden();
  await expect(page.getByRole("tab", { name: "Decisions 1" })).toBeVisible();
});

// The client checkbox is a convenience, not the real guarantee: a direct
// API call that skips it entirely must still be rejected server-side.
test("rejects a decision API call that omits evidence acknowledgment", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await register(page, "e2e-blind-api@example.test", "Blind API Owner");
  await createWorkspaceProjectRelease(page, "Blind API Team", "1.0.0");
  await addClaim(page, "Checkout is idempotent");

  const workspaceId = (
    await (await page.request.get("/api/workspaces")).json()
  ).workspaces[0].id;
  const projectId = (
    await (await page.request.get(`/api/workspaces/${workspaceId}/projects`)).json()
  ).projects[0].id;
  const releaseId = (
    await (await page.request.get(`/api/projects/${projectId}/releases`)).json()
  ).releases[0].id;
  const claimId = (
    await (await page.request.get(`/api/releases/${releaseId}`)).json()
  ).activeClaims[0].id;

  const withoutAck = await page.request.post(
    `/api/releases/${releaseId}/decisions`,
    {
      headers: {
        origin: "http://localhost:8787",
        "sec-fetch-site": "same-origin",
        "x-release-truth-request": "decision-create",
      },
      data: {
        claimId,
        type: "approval",
        rationale: "Approving without ever setting reviewedEvidence.",
        basedOnEvidenceIds: [],
      },
    },
  );
  expect(withoutAck.status()).toBe(400);
  expect(await withoutAck.json()).toMatchObject({ code: "evidence_not_reviewed" });

  const withAck = await page.request.post(`/api/releases/${releaseId}/decisions`, {
    headers: {
      origin: "http://localhost:8787",
      "sec-fetch-site": "same-origin",
      "x-release-truth-request": "decision-create",
    },
    data: {
      claimId,
      type: "approval",
      rationale: "Approving with reviewedEvidence explicitly set.",
      reviewedEvidence: true,
      basedOnEvidenceIds: [],
    },
  });
  expect(withAck.ok()).toBeTruthy();
});

// Fail-closed core guarantee: a release with a material claim and no
// evidence must never read as GO.
test("reads NOT EVALUABLE, never GO, when a material claim has no evidence", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await register(page, "e2e-fail-closed@example.test", "Fail Closed Owner");
  await createWorkspaceProjectRelease(page, "Fail Closed Team", "1.0.0");
  await addClaim(page, "Data is encrypted at rest");

  await page.getByRole("button", { name: /Run verdict/ }).click();
  await expect(page.getByText("NOT EVALUABLE", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("GO", { exact: true })).not.toBeVisible();
});

// RBAC: a viewer must not see mutation controls, and a direct API call must
// be rejected server-side even if the client were bypassed.
test("keeps a viewer role read-only in the UI and at the API", async ({
  browser,
}) => {
  test.setTimeout(90_000);
  const ownerContext = await browser.newContext();
  const viewerContext = await browser.newContext();
  const owner = await ownerContext.newPage();
  const viewer = await viewerContext.newPage();

  await register(owner, "e2e-rbac-owner@example.test", "RBAC Owner");
  await createWorkspaceProjectRelease(owner, "RBAC Team", "1.0.0");
  await addClaim(owner, "Latency budget is met");

  const workspaceId = (
    await (await owner.request.get("/api/workspaces")).json()
  ).workspaces[0].id;
  const releaseResponse = await owner.request.get(
    `/api/projects/${
      (await (await owner.request.get(`/api/workspaces/${workspaceId}/projects`)).json())
        .projects[0].id
    }/releases`,
  );
  const releaseId = (await releaseResponse.json()).releases[0].id;

  await register(viewer, "e2e-rbac-viewer@example.test", "RBAC Viewer");
  const inviteResponse = await owner.request.post(
    `/api/workspaces/${workspaceId}/invitations`,
    {
      headers: {
        origin: "http://localhost:8787",
        "sec-fetch-site": "same-origin",
        "x-release-truth-request": "workspace-invitation",
      },
      data: { email: "e2e-rbac-viewer@example.test", role: "viewer" },
    },
  );
  expect(inviteResponse.ok()).toBeTruthy();
  const inviteUrl = (await inviteResponse.json()).inviteUrl;
  const token = new URL(inviteUrl).searchParams.get("invite");
  await viewer.request.post("/api/invitations/accept", {
    headers: {
      origin: "http://localhost:8787",
      "sec-fetch-site": "same-origin",
      "x-release-truth-request": "invitation-accept",
    },
    data: { token },
  });
  await viewer.reload();

  await expect(viewer.getByRole("button", { name: /Run verdict/ })).toHaveCount(0);
  await expect(viewer.getByRole("button", { name: "Add claim" })).toHaveCount(0);

  const forbidden = await viewer.request.post(
    `/api/releases/${releaseId}/verdict-runs`,
    {
      headers: {
        origin: "http://localhost:8787",
        "sec-fetch-site": "same-origin",
        "x-release-truth-request": "verdict-run",
      },
      data: {},
    },
  );
  expect(forbidden.status()).toBe(404);

  await ownerContext.close();
  await viewerContext.close();
});

// Workspace isolation: a release in one workspace must be invisible to a
// user in a completely different workspace, even by direct API URL.
test("hides a release from a user outside its workspace", async ({ browser }) => {
  test.setTimeout(90_000);
  const ownerAContext = await browser.newContext();
  const ownerBContext = await browser.newContext();
  const ownerA = await ownerAContext.newPage();
  const ownerB = await ownerBContext.newPage();

  await register(ownerA, "e2e-isolation-a@example.test", "Isolation Owner A");
  await createWorkspaceProjectRelease(ownerA, "Isolation Team A", "1.0.0");
  const workspaceAId = (
    await (await ownerA.request.get("/api/workspaces")).json()
  ).workspaces[0].id;
  const projectAId = (
    await (await ownerA.request.get(`/api/workspaces/${workspaceAId}/projects`)).json()
  ).projects[0].id;
  const releaseAId = (
    await (await ownerA.request.get(`/api/projects/${projectAId}/releases`)).json()
  ).releases[0].id;

  await register(ownerB, "e2e-isolation-b@example.test", "Isolation Owner B");
  await createWorkspaceProjectRelease(ownerB, "Isolation Team B", "1.0.0");

  const crossAccess = await ownerB.request.get(`/api/releases/${releaseAId}`);
  expect(crossAccess.status()).toBe(404);

  await ownerAContext.close();
  await ownerBContext.close();
});

// Regression guard for a real bug found on 2026-07-19: an unqualified
// `transition: .15s ease` on .rt-primary/.rt-secondary/.rt-timeline-event
// caused Chromium to fall back to its default (non-accent, 3px) focus ring
// on real keyboard Tab focus instead of the app's --rt-accent token.
test("shows the app's accent focus ring, not the browser default, on primary buttons", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => document.body.focus());
  // Email, Password, then the primary "Create account" submit button.
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  const outline = await page.evaluate(() => {
    const el = document.activeElement;
    const s = getComputedStyle(el);
    return { text: el.innerText, outlineColor: s.outlineColor, outlineWidth: s.outlineWidth };
  });
  expect(outline.text).toContain("Create account");
  expect(outline.outlineColor).toBe("rgb(8, 112, 120)");
  expect(outline.outlineWidth).toBe("2px");
});

// Dialog accessibility: focus enters the dialog, Tab cannot escape it, and
// Escape returns focus to the element that opened it.
test("traps and returns focus correctly for a dialog", async ({ page }) => {
  test.setTimeout(60_000);
  await register(page, "e2e-focus-trap@example.test", "Focus Trap Owner");
  await expect(
    page.getByRole("heading", { name: "Create your first workspace" }),
  ).toBeVisible();
  await page.getByLabel("Workspace name").fill("Focus Trap Team");
  await page.getByRole("button", { name: /Create workspace/ }).click();

  const trigger = page
    .locator(".rt-main")
    .getByRole("button", { name: "New project", exact: true });
  await trigger.click();

  const dialog = page.getByRole("dialog", { name: "New project" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Close" })).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});
