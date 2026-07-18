import { describe, expect, it } from "vitest";
import { applyHumanDecision, calculateVerdict } from "./verdict.js";

const baseFinding = {
  id: "privacy-conflict",
  status: "contradicted",
  confidence: 0.94,
  riskType: "privacy",
};

describe("calculateVerdict", () => {
  it("fails closed on high-confidence privacy contradictions", () => {
    expect(calculateVerdict([baseFinding])).toMatchObject({
      status: "no_go",
      blockers: 1,
    });
  });

  it("returns conditional go for missing evidence", () => {
    expect(
      calculateVerdict([
        { ...baseFinding, status: "unproven", confidence: 0.7 },
      ]),
    ).toMatchObject({
      status: "conditional_go",
      reviews: 1,
    });
  });

  it("returns go when every finding is verified", () => {
    expect(
      calculateVerdict([
        { ...baseFinding, status: "verified", confidence: 0.99 },
      ]),
    ).toMatchObject({
      status: "go",
      blockers: 0,
    });
  });
});

describe("applyHumanDecision", () => {
  it("removes a superseded conflict from blocker calculation", () => {
    const findings = applyHumanDecision([baseFinding], baseFinding.id, "superseded");
    expect(calculateVerdict(findings).status).toBe("go");
  });
});
