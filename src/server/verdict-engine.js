import { calculateVerdict, deriveFindings } from "../lib/verdict.js";
import { activeAppendOnlyRecords, validateAppendOnlyChain } from "./immutable-records.js";

export const ENGINE_VERSION = "release-truth/1.0.0";
export const POLICY_VERSION = "evidence-gate/1";

function iso(value) {
  return value instanceof Date ? value.toISOString() : value;
}

export function buildVerdictInput({ claims, evidence, links, decisions }) {
  if (
    !validateAppendOnlyChain(claims) ||
    !validateAppendOnlyChain(evidence) ||
    !validateAppendOnlyChain(decisions)
  ) {
    return {
      valid: false,
      snapshot: {
        claims: [],
        sources: [],
        decisions: [],
        integrity: "invalid_append_only_chain",
      },
    };
  }
  const currentClaims = activeAppendOnlyRecords(claims);
  const currentEvidence = activeAppendOnlyRecords(evidence);
  const currentDecisions = activeAppendOnlyRecords(decisions);
  const activeClaimIds = new Set(currentClaims.map((claim) => claim.id));
  const activeEvidenceIds = new Set(currentEvidence.map((item) => item.id));
  const evidenceById = new Map(currentEvidence.map((item) => [item.id, item]));
  const sources = links
    .filter(
      (link) =>
        activeClaimIds.has(link.claimId) &&
        activeEvidenceIds.has(link.evidenceId),
    )
    .map((link) => {
      const item = evidenceById.get(link.evidenceId);
      return {
        id: item.id,
        claimId: link.claimId,
        kind: item.evidenceKind,
        relation: item.relation,
        confidence: Number.isFinite(item.sourceMetadata?.confidence)
          ? item.sourceMetadata.confidence
          : null,
        updatedAt: iso(item.capturedAt),
        contentHash: item.contentHash,
      };
    });
  const snapshot = {
    claims: currentClaims.map((claim) => ({
      id: claim.id,
      title: claim.title,
      material: claim.material,
      riskType: claim.payloadSnapshot?.riskType || "release",
      requiredEvidenceKinds: claim.requiredEvidenceKinds,
      updatedAt: iso(claim.capturedAt),
      contentHash: claim.contentHash,
    })),
    sources,
    decisions: currentDecisions.map((decision) => ({
      id: decision.id,
      type: decision.type,
      status: decision.status,
      claimId: decision.claimId,
      basedOnEvidenceIds: decision.basedOnEvidenceIds,
      createdAt: iso(decision.createdAt),
      contentHash: decision.contentHash,
    })),
    integrity: "verified",
  };
  return { valid: true, snapshot };
}

export function evaluateVerdict(input) {
  if (!input.valid) {
    return {
      result: {
        status: "not_evaluable",
        label: "NOT EVALUABLE",
        detail: "Append-only input integrity validation failed",
        blockers: 0,
        reviews: 0,
        coverageGaps: 1,
      },
      reasonCodes: ["INPUT_INTEGRITY_INVALID"],
    };
  }
  const result = calculateVerdict(input.snapshot);
  const findings = deriveFindings(input.snapshot);
  const reasonCodes = new Set();
  if (input.snapshot.claims.filter((claim) => claim.material).length === 0) {
    reasonCodes.add("NO_MATERIAL_CLAIMS");
  }
  if (findings.some((finding) => finding.status === "contradicted")) {
    reasonCodes.add("CURRENT_EVIDENCE_CONTRADICTS_CLAIM");
  }
  if (findings.some((finding) => finding.missingKinds?.length > 0)) {
    reasonCodes.add("REQUIRED_EVIDENCE_MISSING");
  }
  if (findings.some((finding) => finding.staleKinds?.length > 0)) {
    reasonCodes.add("EVIDENCE_STALE");
  }
  if (result.status === "conditional_go") {
    reasonCodes.add("CURRENT_APPROVAL_REQUIRED");
  }
  if (result.status === "go") reasonCodes.add("ALL_GATES_SATISFIED");
  if (reasonCodes.size === 0) reasonCodes.add("NOT_EVALUABLE_FAIL_CLOSED");
  return { result, reasonCodes: [...reasonCodes].sort() };
}

