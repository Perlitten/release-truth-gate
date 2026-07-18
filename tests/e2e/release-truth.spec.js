import { expect, test } from "@playwright/test";

test("renders one deduplicated issue and working navigation", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("NO-GO", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Summary" }).click();
  await expect(page.getByText("Distinct blocking issues")).toBeVisible();
  await expect(
    page
      .locator(".metric-card")
      .filter({ hasText: "Distinct blocking issues" })
      .getByText("1", { exact: true }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Risks" }).click();
  const riskRows = page.locator(".evidence-list > button");
  await expect(riskRows).toHaveCount(1);
});

test("search filters source registry and the explanatory dialog traps focus", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Evidence", exact: true }).click();
  await page.getByRole("textbox", { name: "Search evidence" }).fill("c5e8f92");
  await expect(page.locator(".evidence-list > button")).toHaveCount(1);
  await expect(page.getByText("Current privacy boundary test")).toBeVisible();

  await page
    .getByRole("button", { name: "Release Timeline", exact: true })
    .click();
  await page.getByRole("button", { name: "How the gate works" }).click();
  await expect(
    page.getByRole("dialog", { name: "How the release gate works" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("review proposal appends a decision without changing source evidence", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Record review proposal" }).click();
  await page
    .getByRole("textbox", { name: "Reason" })
    .fill("Request a replacement claim after the telemetry field is removed.");
  await page.getByRole("button", { name: "Append proposal" }).click();

  await expect(page.getByText("NO-GO", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Contradicted", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Decisions", exact: true }).click();
  await expect(
    page.getByText(
      "Request a replacement claim after the telemetry field is removed.",
      { exact: false },
    ),
  ).toBeVisible();
});

test("AI failures stay explicit and never become a demo assessment", async ({ page }) => {
  await page.route("**/api/analyze", async (route) => {
    await route.fulfill({
      status: 502,
      contentType: "application/json",
      body: JSON.stringify({ error: "Synthetic upstream failure." }),
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Unlock live AI review" }).click();
  await page.getByLabel("Access code").fill("release-truth-e2e");
  await page.getByRole("button", { name: "Unlock", exact: true }).click();
  await page.getByRole("button", { name: "Run live AI evidence review" }).click();

  await expect(page.locator(".toast.error")).toContainText(
    "Live AI review failed",
  );
  await expect(page.locator(".live-label")).toHaveCount(0);
});

test("mobile keeps the current blocker visible and prevents page overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      name: "Telemetry change invalidated the July 16 privacy approval.",
    }),
  ).toBeVisible();
  for (const label of [
    "Release Timeline",
    "Summary",
    "Evidence",
    "Risks",
    "Decisions",
  ]) {
    await expect(
      page.getByRole("button", { name: label, exact: true }),
    ).toBeVisible();
  }
  const dimensions = await page.evaluate(() => ({
    pageWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
    timelineScrollable:
      document.querySelector(".timeline").scrollWidth >
      document.querySelector(".timeline").clientWidth,
  }));
  expect(dimensions.pageWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
  expect(dimensions.timelineScrollable).toBe(true);
});

test("serves strict browser hardening headers", async ({ page }) => {
  const response = await page.goto("/");
  const headers = response.headers();
  expect(headers["content-security-policy"]).toContain("nonce-");
  expect(headers["content-security-policy"]).not.toContain("'unsafe-inline'");
  expect(headers["content-security-policy"]).not.toContain("'unsafe-eval'");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-frame-options"]).toBe("DENY");
});
