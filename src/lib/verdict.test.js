import { describe, expect, it } from "vitest";
import {
  appendDecision,
  calculateVerdict,
  createDecisionRecord,
  deriveFindings,
} from "./verdict.js";

const claim = {
  id: "privacy-message-content",
  title: "Privacy boundary",
  text: "We do not store message content.",
  riskType: "privacy",
  material: true,
  currentRevision: "claim-2",
  updatedAt: "2026-07-18T08:00:00Z",
  requiredEvidenceKinds: ["claim", "code", "test"],
};

function source(kind, relation = "supports", overrides = {}) {
  return {
    id: `${kind}-${relation}-${overrides.revision || "1"}`,
    claimId: claim.id,
    kind,
    relation,
    confidence: 0.95,
    revision: overrides.revision || "1",
    updatedAt: overrides.updatedAt || "2026-07-18T09:00:00Z",
    content: `${kind} ${relation}`,
    ...overrides,
  };
}

function approval(sources) {
  return {
    id: "approval-1",
    type: "approval",
    claimId: claim.id,
    status: "approved",
    actor: "Jordan Lee",
    reason: "Reviewed current supporting evidence.",
    createdAt: "2026-07-18T10:00:00Z",
    evidenceHead: "head-1",
    basedOnEvidenceIds: sources.map((item) => item.id),
  };
}

function input(overrides = {}) {
  const sources = [
    source("claim"),
    source("code"),
    source("test"),
  ];
  return {
    claims: [claim],
    sources,
    decisions: [approval(sources)],
    ...overrides,
  };
}

describe("calculateVerdict", () => {
  it.each([
    ["missing input", undefined],
    ["empty material claims", { claims: [], sources: [], decisions: [] }],
    [
      "unknown evidence relation",
      input({
        sources: [
          source("claim"),
          source("code", "unknown"),
          source("test"),
        ],
      }),
    ],
    [
      "incomplete claim coverage",
      input({ sources: [source("claim"), source("code")] }),
    ],
  ])("fails closed for %s", (_label, value) => {
    expect(calculateVerdict(value).status).toBe("not_evaluable");
  });

  it("deduplicates multiple contradicting sources into one blocker", () => {
    const value = input({
      sources: [
        source("claim"),
        source("code", "contradicts"),
        source("test", "contradicts"),
      ],
      decisions: [],
    });
    const findings = deriveFindings(value);

    expect(findings).toHaveLength(1);
    expect(findings[0].evidenceIds).toHaveLength(2);
    expect(calculateVerdict({ ...value, findings })).toMatchObject({
      status: "no_go",
      blockers: 1,
    });
  });

  it("blocks every current contradiction regardless of model confidence or risk label", () => {
    const value = input({
      claims: [{ ...claim, riskType: "commercial" }],
      sources: [
        source("claim"),
        source("code", "contradicts", { confidence: 0.2 }),
        source("test"),
      ],
      decisions: [],
    });

    expect(calculateVerdict(value)).toMatchObject({
      status: "no_go",
      blockers: 1,
    });
  });

  it("derives authoritative findings and ignores caller-supplied finding lists", () => {
    const contradicted = input({
      sources: [
        source("claim"),
        source("code", "contradicts"),
        source("test"),
      ],
      decisions: [],
      findings: [],
    });
    const supported = input({
      findings: [
        {
          id: "forged",
          status: "contradicted",
          confidence: 1,
          riskType: "privacy",
        },
      ],
    });

    expect(calculateVerdict(contradicted).status).toBe("no_go");
    expect(calculateVerdict(supported).status).toBe("go");
  });

  it("requires approval tied to the current evidence head", () => {
    const value = input();
    expect(calculateVerdict({ ...value, decisions: [] })).toMatchObject({
      status: "conditional_go",
      reviews: 1,
    });
  });

  it("returns go only with complete supporting evidence and current approval", () => {
    expect(calculateVerdict(input())).toMatchObject({
      status: "go",
      blockers: 0,
      reviews: 0,
    });
  });
});

describe("append-only human decisions", () => {
  it("does not mutate evidence or remove a blocker", () => {
    const value = input({
      sources: [
        source("claim"),
        source("code", "contradicts"),
        source("test", "contradicts"),
      ],
      decisions: [],
    });
    const findings = deriveFindings(value);
    const frozenSources = structuredClone(value.sources);
    const record = createDecisionRecord({
      id: "decision-new",
      action: "risk_waiver_request",
      actor: "Jordan Lee",
      reason: "Request a time-bounded review of the current privacy conflict.",
      issue: findings[0],
      evidenceHead: "head-2",
      createdAt: "2026-07-18T11:00:00Z",
      expiresAt: "2026-07-19T11:00:00Z",
    });
    const decisions = appendDecision(value.decisions, record);

    expect(value.sources).toEqual(frozenSources);
    expect(decisions).toHaveLength(1);
    expect(decisions[0]).toMatchObject({
      issueId: findings[0].id,
      status: "pending",
      basedOnEvidenceIds: findings[0].evidenceIds,
    });
    expect(calculateVerdict({ ...value, findings, decisions }).status).toBe(
      "no_go",
    );
  });
});
