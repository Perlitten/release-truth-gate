import { describe, expect, it } from "vitest";

import { roleCan } from "./rbac.js";

describe("workspace role capabilities", () => {
  it("keeps viewer read-only except for completed exports", () => {
    expect(roleCan("viewer", "view")).toBe(true);
    expect(roleCan("viewer", "generate_export")).toBe(true);
    expect(roleCan("viewer", "create_evidence")).toBe(false);
    expect(roleCan("viewer", "create_decision")).toBe(false);
  });

  it("allows reviewers to decide and recompute but not manage integrations", () => {
    expect(roleCan("reviewer", "create_decision")).toBe(true);
    expect(roleCan("reviewer", "run_verdict")).toBe(true);
    expect(roleCan("reviewer", "manage_integrations")).toBe(false);
    expect(roleCan("reviewer", "manage_members")).toBe(false);
  });

  it("allows contributors to create evidence but not decisions or roles", () => {
    expect(roleCan("contributor", "create_project")).toBe(true);
    expect(roleCan("contributor", "create_evidence")).toBe(true);
    expect(roleCan("contributor", "create_decision")).toBe(false);
    expect(roleCan("contributor", "manage_members")).toBe(false);
  });
});

