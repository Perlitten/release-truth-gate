const KNOWN_RELATIONS = new Set(["supports", "contradicts", "missing"]);

function newestFirst(left, right) {
  return Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
}

function isValidDate(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function latestApprovedDecision(decisions, claimId) {
  return (
    decisions
      .filter(
        (decision) =>
          decision.type === "approval" &&
          decision.status === "approved" &&
          decision.claimId === claimId &&
          isValidDate(decision.createdAt),
      )
      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))[0] ||
    null
  );
}

export function deriveClaimCoverage(claims, sources) {
  if (!Array.isArray(claims) || !Array.isArray(sources)) return [];

  return claims
    .filter((claim) => claim?.material)
    .map((claim) => {
      const claimSources = sources.filter((source) => source?.claimId === claim.id);
      const latestByKind = Object.fromEntries(
        claim.requiredEvidenceKinds.map((kind) => [
          kind,
          claimSources
            .filter((source) => source.kind === kind && isValidDate(source.updatedAt))
            .sort(newestFirst)[0] || null,
        ]),
      );
      const missingKinds = claim.requiredEvidenceKinds.filter(
        (kind) => !latestByKind[kind],
      );
      const invalidKinds = claim.requiredEvidenceKinds.filter((kind) => {
        const source = latestByKind[kind];
        return source && !KNOWN_RELATIONS.has(source.relation);
      });
      const staleKinds = claim.requiredEvidenceKinds.filter((kind) => {
        const source = latestByKind[kind];
        return (
          source &&
          isValidDate(claim.updatedAt) &&
          Date.parse(source.updatedAt) < Date.parse(claim.updatedAt) &&
          kind !== "claim"
        );
      });
      const contradictedKinds = claim.requiredEvidenceKinds.filter(
        (kind) => latestByKind[kind]?.relation === "contradicts",
      );
      const supportedKinds = claim.requiredEvidenceKinds.filter(
        (kind) => latestByKind[kind]?.relation === "supports",
      );

      return {
        claimId: claim.id,
        riskType: claim.riskType,
        requiredKinds: [...claim.requiredEvidenceKinds],
        latestByKind,
        missingKinds,
        invalidKinds,
        staleKinds,
        contradictedKinds,
        supportedKinds,
        complete:
          missingKinds.length === 0 &&
          invalidKinds.length === 0 &&
          staleKinds.length === 0,
        fullySupported:
          missingKinds.length === 0 &&
          invalidKinds.length === 0 &&
          staleKinds.length === 0 &&
          contradictedKinds.length === 0 &&
          supportedKinds.length === claim.requiredEvidenceKinds.length,
      };
    });
}

export function deriveFindings({ claims, sources, decisions = [] }) {
  const coverage = deriveClaimCoverage(claims, sources);

  return coverage.flatMap((item) => {
    const claim = claims.find((candidate) => candidate.id === item.claimId);
    const latestSources = Object.values(item.latestByKind).filter(Boolean);
    const contradictions = latestSources.filter(
      (source) => source.relation === "contradicts",
    );
    const approval = latestApprovedDecision(decisions, item.claimId);
    const approvalTime = approval ? Date.parse(approval.createdAt) : null;
    const staleDecisionIds =
      approval &&
      latestSources.some(
        (source) =>
          Date.parse(source.updatedAt) > approvalTime &&
          !approval.basedOnEvidenceIds?.includes(source.id),
      )
        ? [approval.id]
        : [];

    if (contradictions.length > 0) {
      return [
        {
          id: `${item.claimId}:current-conflict`,
          claimId: item.claimId,
          title: `${claim.title} conflicts with the current evidence head`,
          status: "contradicted",
          confidence: Math.max(
            ...contradictions.map((source) =>
              Number.isFinite(source.confidence) ? source.confidence : 0,
            ),
          ),
          riskType: item.riskType,
          evidenceIds: contradictions.map((source) => source.id),
          staleDecisionIds,
          missingKinds: item.missingKinds,
          invalidKinds: item.invalidKinds,
          staleKinds: item.staleKinds,
        },
      ];
    }

    if (!item.complete || !item.fullySupported) {
      return [
        {
          id: `${item.claimId}:coverage-gap`,
          claimId: item.claimId,
          title: `${claim.title} does not have complete current evidence`,
          status: "unproven",
          confidence: null,
          riskType: item.riskType,
          evidenceIds: latestSources.map((source) => source.id),
          staleDecisionIds,
          missingKinds: item.missingKinds,
          invalidKinds: item.invalidKinds,
          staleKinds: item.staleKinds,
        },
      ];
    }

    return [];
  });
}

function currentApprovalForCoverage(decisions, coverageItem) {
  const approval = latestApprovedDecision(decisions, coverageItem.claimId);
  if (!approval) return false;

  const currentEvidenceIds = Object.values(coverageItem.latestByKind)
    .filter(Boolean)
    .map((source) => source.id);

  return currentEvidenceIds.every((sourceId) =>
    approval.basedOnEvidenceIds?.includes(sourceId),
  );
}

export function calculateVerdict(input) {
  if (
    !input ||
    !Array.isArray(input.claims) ||
    !Array.isArray(input.sources) ||
    !Array.isArray(input.decisions) ||
    input.claims.filter((claim) => claim?.material).length === 0
  ) {
    return {
      status: "not_evaluable",
      label: "NOT EVALUABLE",
      detail: "Material claims or evidence inputs are missing",
      blockers: 0,
      reviews: 0,
      coverageGaps: 1,
    };
  }

  const coverage = deriveClaimCoverage(input.claims, input.sources);
  const findings = deriveFindings(input);
  const incompleteCoverage = coverage.filter((item) => !item.complete);
  const blockers = findings.filter(
    (finding) => finding.status === "contradicted",
  );
  const reviews = findings.filter(
    (finding) =>
      finding.status === "pending" ||
      finding.status === "unproven",
  );

  if (blockers.length > 0) {
    return {
      status: "no_go",
      label: "NO-GO",
      detail: `${blockers.length} deduplicated ${
        blockers.length === 1 ? "issue blocks" : "issues block"
      } launch`,
      blockers: blockers.length,
      reviews: reviews.length,
      coverageGaps: incompleteCoverage.length,
    };
  }

  if (incompleteCoverage.length > 0) {
    return {
      status: "not_evaluable",
      label: "NOT EVALUABLE",
      detail: `${incompleteCoverage.length} material ${
        incompleteCoverage.length === 1 ? "claim lacks" : "claims lack"
      } complete current evidence`,
      blockers: 0,
      reviews: reviews.length,
      coverageGaps: incompleteCoverage.length || 1,
    };
  }

  const allSupported =
    coverage.length > 0 && coverage.every((item) => item.fullySupported);
  const allApproved =
    allSupported &&
    coverage.every((item) => currentApprovalForCoverage(input.decisions, item));

  if (reviews.length > 0 || !allSupported || !allApproved) {
    const approvalGap = allSupported && !allApproved;
    return {
      status: "conditional_go",
      label: "CONDITIONAL GO",
      detail: approvalGap
        ? "Current evidence is complete; approval for this evidence head is required"
        : `${Math.max(reviews.length, 1)} ${
            Math.max(reviews.length, 1) === 1 ? "review is" : "reviews are"
          } still required`,
      blockers: 0,
      reviews: Math.max(reviews.length, approvalGap ? 1 : 0),
      coverageGaps: 0,
    };
  }

  return {
    status: "go",
    label: "GO",
    detail: "Every material claim has current supporting evidence and approval",
    blockers: 0,
    reviews: 0,
    coverageGaps: 0,
  };
}

export function createDecisionRecord({
  id,
  action,
  actor,
  reason,
  issue,
  evidenceHead,
  createdAt,
  expiresAt = null,
}) {
  if (!issue?.id || !issue.claimId) {
    throw new Error("A decision must target a derived issue and claim.");
  }
  if (!["supersession_proposal", "risk_waiver_request"].includes(action)) {
    throw new Error("Unsupported decision action.");
  }
  if (typeof actor !== "string" || actor.trim().length < 2) {
    throw new Error("A decision actor is required.");
  }
  if (typeof reason !== "string" || reason.trim().length < 12) {
    throw new Error("A specific decision reason is required.");
  }
  if (!isValidDate(createdAt)) {
    throw new Error("A valid decision timestamp is required.");
  }

  return Object.freeze({
    id,
    type: action,
    claimId: issue.claimId,
    issueId: issue.id,
    status: "pending",
    actor: actor.trim(),
    reason: reason.trim(),
    createdAt,
    expiresAt: expiresAt || null,
    evidenceHead,
    basedOnEvidenceIds: Object.freeze([...(issue.evidenceIds || [])]),
  });
}

export function appendDecision(decisions, record) {
  if (!Array.isArray(decisions)) throw new Error("Decision history must be an array.");
  if (decisions.some((decision) => decision.id === record.id)) {
    throw new Error("Decision IDs must be unique.");
  }
  return [...decisions, record];
}
