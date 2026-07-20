import { LANE_TO_FOCUS } from "./timeline-constants.js";
import { EVIDENCE_RELATION_PRIORITY } from "./audit-constants.js";

export function byBlockingPriority(left, right) {
  const rank =
    (EVIDENCE_RELATION_PRIORITY[left.relation] ?? 3) -
    (EVIDENCE_RELATION_PRIORITY[right.relation] ?? 3);
  return rank !== 0 ? rank : Date.parse(right.capturedAt) - Date.parse(left.capturedAt);
}

export function evidenceTimelineStatus(relation) {
  if (relation === "supports") return "verified";
  if (relation === "contradicts") return "contradicted";
  return "pending";
}

export function timelineLaneForEvidence(item) {
  if (item.evidenceKind === "claim" || item.sourceType === "claim") return "claim";
  if (["test", "check_run", "status", "check"].includes(item.evidenceKind)) return "test";
  return "code";
}

export function decisionTimelineStatus(decision) {
  if (decision.type === "rejection" || decision.status === "rejected") return "contradicted";
  if (decision.type === "approval" && decision.status === "approved") return "verified";
  return "pending";
}

export function buildAnalysisPayload(event, snapshot) {
  if (!event.claimId) return null;
  const claim = snapshot.activeClaims.find((item) => item.id === event.claimId);
  if (!claim) return null;
  const evidenceIdsForClaim = new Set(
    snapshot.links
      .filter((link) => link.claimId === event.claimId)
      .map((link) => link.evidenceId),
  );
  const sources = snapshot.activeEvidence
    .filter((item) => evidenceIdsForClaim.has(item.id))
    .slice(0, 12)
    .map((item) => ({
      id: item.id,
      kind: item.evidenceKind,
      title: item.summary,
      revision: item.sourceMetadata?.revision || item.id,
      updatedAt: new Date(item.capturedAt).toISOString(),
      content: (item.payloadSnapshot?.content || item.summary).slice(0, 4000),
    }));
  if (sources.length === 0) return null;

  const approvedDecision = snapshot.activeDecisions
    .filter(
      (decision) =>
        decision.claimId === event.claimId &&
        decision.type === "approval" &&
        decision.status === "approved",
    )
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))[0];

  return {
    claim: {
      id: claim.id,
      text: (claim.description || claim.title).slice(0, 600),
      riskType: claim.payloadSnapshot?.riskType || "core_workflow",
      currentRevision: claim.payloadSnapshot?.currentRevision || claim.id,
    },
    focus: {
      eventId: event.id,
      title: event.title.slice(0, 180),
      lane: LANE_TO_FOCUS[event.lane] || "code",
      status: event.status,
      revision: event.detail.revision || claim.payloadSnapshot?.currentRevision || "unknown",
      timestamp: new Date(event.at).toISOString(),
    },
    decision: approvedDecision
      ? {
          id: approvedDecision.id,
          summary: approvedDecision.rationale.slice(0, 400),
          approvedAt: new Date(approvedDecision.createdAt).toISOString(),
          evidenceHead: claim.contentHash || claim.id,
        }
      : null,
    sources,
  };
}
