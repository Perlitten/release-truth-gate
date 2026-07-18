import { readFile } from "node:fs/promises";

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

test("two users share evidence, review it, run GO, and verify a signed export", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const ownerContext = await browser.newContext({ acceptDownloads: true });
  const reviewerContext = await browser.newContext();
  const owner = await ownerContext.newPage();
  const reviewer = await reviewerContext.newPage();

  await register(owner, "e2e-owner@example.test", "E2E Owner");
  await expect(owner.getByRole("heading", { name: "Create your first workspace" })).toBeVisible();
  await owner.getByLabel("Workspace name").fill("E2E Release Team");
  await owner.getByRole("button", { name: /Create workspace/ }).click();

  await owner
    .locator(".rt-main")
    .getByRole("button", { name: "New project", exact: true })
    .click();
  await owner.getByLabel("Project name").fill("Payments API");
  await owner.getByRole("button", { name: /Create record/ }).click();
  await owner.getByRole("button", { name: "New release" }).click();
  await owner.getByLabel("Release name").fill("1.0.0");
  await owner.getByLabel("Target value").fill("v1.0.0");
  await owner.getByRole("button", { name: /Create record/ }).click();

  await owner.getByRole("button", { name: "Claims 0" }).click();
  await owner.getByRole("button", { name: "Add claim" }).click();
  await owner.getByLabel("Claim", { exact: true }).fill("Checkout is idempotent");
  await owner
    .getByLabel("What must be true?")
    .fill("Duplicate requests create only one charge.");
  await owner
    .getByLabel("Acceptance criteria")
    .fill("The idempotency integration test passes.");
  await owner.getByLabel("Required evidence kinds").fill("test");
  await owner.getByRole("button", { name: /Create record/ }).click();

  await owner.getByRole("button", { name: "Evidence 0" }).click();
  await owner.getByRole("button", { name: "Add evidence" }).click();
  await owner
    .getByLabel("Evidence summary")
    .fill("Integration test passed against the release tag.");
  await owner.getByLabel("Evidence kind").fill("test");
  await owner.getByRole("button", { name: /Create record/ }).click();
  await owner.getByRole("button", { name: /Run verdict/ }).click();
  await expect(owner.getByText("CONDITIONAL GO", { exact: true })).toBeVisible();

  await register(reviewer, "e2e-reviewer@example.test", "E2E Reviewer");
  const workspaceResponse = await owner.request.get("/api/workspaces");
  const workspaceId = (await workspaceResponse.json()).workspaces[0].id;
  const inviteResponse = await owner.request.post(
    `/api/workspaces/${workspaceId}/invitations`,
    {
      headers: {
        origin: "http://localhost:8787",
        "sec-fetch-site": "same-origin",
        "x-release-truth-request": "workspace-invitation",
      },
      data: {
        email: "e2e-reviewer@example.test",
        role: "reviewer",
      },
    },
  );
  expect(inviteResponse.ok()).toBeTruthy();
  const inviteUrl = (await inviteResponse.json()).inviteUrl;
  const token = new URL(inviteUrl).searchParams.get("invite");
  const acceptResponse = await reviewer.request.post("/api/invitations/accept", {
    headers: {
      origin: "http://localhost:8787",
      "sec-fetch-site": "same-origin",
      "x-release-truth-request": "invitation-accept",
    },
    data: { token },
  });
  expect(acceptResponse.ok()).toBeTruthy();

  await reviewer.reload();
  await reviewer
    .getByRole("button", { name: "Payments API", exact: true })
    .click();
  await reviewer.getByRole("button", { name: "Decisions 0" }).click();
  await reviewer.getByRole("button", { name: "Record decision" }).click();
  await reviewer.getByLabel("Rationale").fill(
    "The linked integration test directly satisfies the acceptance criterion.",
  );
  await reviewer.getByRole("button", { name: /Create record/ }).click();
  await reviewer.getByRole("button", { name: /Run verdict/ }).click();
  await expect(reviewer.getByText("GO", { exact: true })).toBeVisible();

  await owner.getByRole("button", { name: /Refresh/ }).click();
  await expect(owner.getByText("GO", { exact: true })).toBeVisible();
  const downloadPromise = owner.waitForEvent("download");
  await owner.getByRole("button", { name: /Signed export/ }).click();
  const download = await downloadPromise;
  const exportEnvelope = JSON.parse(await readFile(await download.path(), "utf8"));
  const verifyResponse = await owner.request.post("/api/exports/verify", {
    data: exportEnvelope,
  });
  expect(verifyResponse.ok()).toBeTruthy();
  expect(await verifyResponse.json()).toMatchObject({
    valid: true,
    reason: "signature_valid",
    publicKeyId: "e2e-ed25519",
  });

  exportEnvelope.manifest.verdictRun.result.status = "no_go";
  const tamperedResponse = await owner.request.post("/api/exports/verify", {
    data: exportEnvelope,
  });
  expect(await tamperedResponse.json()).toMatchObject({
    valid: false,
    reason: "artifact_hash_mismatch",
  });

  await ownerContext.close();
  await reviewerContext.close();
});

test("serves strict browser hardening headers and no authoritative local storage", async ({
  page,
}) => {
  const response = await page.goto("/");
  const headers = response.headers();
  expect(headers["content-security-policy"]).toContain("nonce-");
  expect(headers["content-security-policy"]).not.toContain("'unsafe-inline'");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);
});
