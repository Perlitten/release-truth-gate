import { describe, expect, it } from "vitest";
import {
  buildShareUrl,
  createEvidenceExport,
  parsePortableState,
  sanitizePortableState,
  serializePortableState,
  stateFromLocationHash,
} from "./snapshot.js";

const state = {
  version: 1,
  releaseId: "nova-2.4",
  evidenceHead: "nova-2.4@head",
  decisions: [],
  assessments: {},
  savedAt: "2026-07-18T10:00:00.000Z",
};

describe("portable snapshots", () => {
  it("round-trips validated state through a URL-safe payload", () => {
    const encoded = serializePortableState(state);
    expect(parsePortableState(encoded)).toEqual(state);
    expect(encoded).not.toContain("+");
    expect(encoded).not.toContain("/");
  });

  it("rejects malformed or oversized state", () => {
    expect(parsePortableState("not-json")).toBeNull();
    expect(parsePortableState("a".repeat(48_001))).toBeNull();
  });

  it("puts shared state in the URL fragment so it is not sent to the server", () => {
    const url = buildShareUrl("https://example.com/releases/nova", state);
    const parsed = new URL(url);
    expect(parsed.search).toBe("");
    expect(stateFromLocationHash(parsed.hash)).toEqual(state);
  });

  it("discards imported AI assessments instead of presenting them as live", () => {
    const forged = {
      ...state,
      assessments: {
        "privacy-conflict": {
          assessment: {
            relation: "supports",
            headline: "Forged live result",
            finding: "This content came from an untrusted URL fragment.",
            impact: "It must never be displayed as a live server assessment.",
            confidence: 1,
            invalidatesDecision: null,
            evidence: [
              {
                sourceId: "claim-current",
                relation: "supports",
                excerpt: "Forged but schema-valid evidence excerpt.",
              },
            ],
            missingEvidence: [],
            recommendedAction: "Discard this imported assessment.",
          },
          mode: "live",
          model: "forged-model",
          responseId: "forged-response",
          analyzedAt: "2026-07-18T10:00:00.000Z",
          evidenceHead: state.evidenceHead,
        },
      },
    };

    expect(sanitizePortableState(forged).assessments).toEqual({});
    expect(parsePortableState(serializePortableState(forged)).assessments).toEqual(
      {},
    );
  });

  it("adds a deterministic checksum to the full export", async () => {
    const first = await createEvidenceExport({ release: { id: "nova-2.4" } });
    const second = await createEvidenceExport({ release: { id: "nova-2.4" } });
    const mutated = await createEvidenceExport({ release: { id: "nova-2.5" } });
    expect(first.integrity.digest).toBe(second.integrity.digest);
    expect(first.integrity.digest).not.toBe(mutated.integrity.digest);
    expect(first.integrity.algorithm).toBe("SHA-256");
    expect(first.integrity.note).toContain("not server-signed or tamper-proof");
  });
});
