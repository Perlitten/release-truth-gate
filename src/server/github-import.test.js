import { describe, expect, it } from "vitest";

import { normalizeGitHubObject } from "./github-import.js";

describe("GitHub provenance normalization", () => {
  it("normalizes issue data without retaining unbounded response fields", () => {
    const normalized = normalizeGitHubObject("issue", {
      id: 17,
      node_id: "I_17",
      number: 4,
      title: "Rollback works",
      body: "criterion",
      state: "open",
      user: { id: 9, login: "octo", type: "User" },
      labels: [{ name: "release" }],
      assignees: [],
      created_at: "2026-07-18T10:00:00Z",
      updated_at: "2026-07-18T11:00:00Z",
      html_url: "https://github.com/acme/api/issues/4",
      unexpected_secret: "not copied",
    });
    expect(normalized.id).toBe("17");
    expect(normalized.labels).toEqual(["release"]);
    expect(normalized).not.toHaveProperty("unexpected_secret");
  });
});
