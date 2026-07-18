import { describe, expect, it } from "vitest";

import {
  buildVerdictInput,
  evaluateVerdict,
} from "./verdict-engine.js";

function record(id, overrides = {}) {
  return {
    id,
    recordAction: "snapshot",
    supersedesId: null,
    contentHash: id.padEnd(64, "0"),
    ...overrides,
  };
}

describe("server verdict adapter", () => {
  it("fails closed when an append-only chain is invalid", () => {
    const input = buildVerdictInput({
      claims: [
        record("claim", {
          supersedesId: "missing",
          recordAction: "correction",
        }),
      ],
      evidence: [],
      decisions: [],
      links: [],
    });
    expect(input.valid).toBe(false);
    expect(evaluateVerdict(input)).toEqual(
      expect.objectContaining({
        result: expect.objectContaining({ status: "not_evaluable" }),
        reasonCodes: ["INPUT_INTEGRITY_INVALID"],
      }),
    );
  });

  it("requires a current approval before returning GO", () => {
    const claim = record("claim", {
      title: "Payment is idempotent",
      material: true,
      requiredEvidenceKinds: ["test"],
      capturedAt: new Date("2026-07-18T12:00:00Z"),
      payloadSnapshot: {},
    });
    const proof = record("evidence", {
      evidenceKind: "test",
      relation: "supports",
      capturedAt: new Date("2026-07-18T13:00:00Z"),
      sourceMetadata: {},
    });
    const linked = { claimId: claim.id, evidenceId: proof.id };
    const pending = buildVerdictInput({
      claims: [claim],
      evidence: [proof],
      decisions: [],
      links: [linked],
    });
    expect(evaluateVerdict(pending).result.status).toBe("conditional_go");

    const approval = record("decision", {
      type: "approval",
      status: "approved",
      claimId: claim.id,
      basedOnEvidenceIds: [proof.id],
      createdAt: new Date("2026-07-18T14:00:00Z"),
    });
    const approved = buildVerdictInput({
      claims: [claim],
      evidence: [proof],
      decisions: [approval],
      links: [linked],
    });
    expect(evaluateVerdict(approved)).toEqual(
      expect.objectContaining({
        result: expect.objectContaining({ status: "go", label: "GO" }),
        reasonCodes: ["ALL_GATES_SATISFIED"],
      }),
    );
  });
});

