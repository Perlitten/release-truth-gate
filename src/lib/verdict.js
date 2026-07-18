const BLOCKING_TYPES = new Set(["privacy", "security", "data_integrity", "core_workflow"]);

export function calculateVerdict(findings) {
  const blockers = findings.filter(
    (finding) =>
      finding.status === "contradicted" &&
      finding.confidence >= 0.75 &&
      BLOCKING_TYPES.has(finding.riskType),
  );
  const reviews = findings.filter(
    (finding) =>
      finding.status === "pending" ||
      finding.status === "unproven" ||
      (finding.status === "contradicted" && !blockers.includes(finding)),
  );

  if (blockers.length > 0) {
    return {
      status: "no_go",
      label: "NO-GO",
      detail: `${blockers.length} evidence ${blockers.length === 1 ? "conflict blocks" : "conflicts block"} launch`,
      blockers: blockers.length,
      reviews: reviews.length,
    };
  }

  if (reviews.length > 0) {
    return {
      status: "conditional_go",
      label: "CONDITIONAL GO",
      detail: `${reviews.length} ${reviews.length === 1 ? "review is" : "reviews are"} still required`,
      blockers: 0,
      reviews: reviews.length,
    };
  }

  return {
    status: "go",
    label: "GO",
    detail: "Current evidence supports the launch claims",
    blockers: 0,
    reviews: 0,
  };
}

export function applyHumanDecision(findings, eventId, decision) {
  return findings.map((finding) => {
    if (finding.id !== eventId) return finding;

    if (decision === "accept_risk") {
      return {
        ...finding,
        status: "pending",
        confidence: 0.65,
        humanDecision: "Risk accepted for launch review",
      };
    }

    if (decision === "superseded") {
      return {
        ...finding,
        status: "superseded",
        confidence: 1,
        humanDecision: "Prior claim marked superseded",
      };
    }

    return finding;
  });
}
