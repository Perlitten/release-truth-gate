"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ClockCounterClockwise } from "@phosphor-icons/react";
import { EmptyState } from "../components/feedback/EmptyState.jsx";
import { TimelineBoard } from "../components/timeline/TimelineBoard.jsx";
import { TimelineDetail } from "../components/timeline/TimelineDetail.jsx";
import { AIAssessment } from "../components/timeline/AIAssessment.jsx";
import { api } from "../lib/api.js";
import {
  formatDate,
  formatFullTimestamp,
  formatTime,
  formatTimelineDay,
  timelineDayKey,
} from "../lib/format.js";
import {
  evidenceTimelineStatus,
  timelineLaneForEvidence,
  decisionTimelineStatus,
  buildAnalysisPayload,
} from "../lib/timeline-logic.js";

export function TimelineTab({ snapshot, focusClaimId, onFocusHandled }) {
  const events = useMemo(() => {
    const claimIdByEvidenceId = new Map(
      snapshot.links.map((link) => [link.evidenceId, link.claimId]),
    );
    const list = [];
    for (const claim of snapshot.activeClaims) {
      list.push({
        id: `claim:${claim.id}`,
        lane: "claim",
        at: claim.createdAt,
        title: claim.title,
        status: "pending",
        statusLabel: "Registered",
        claimId: claim.id,
        detail: {
          kind: "release claim",
          excerpt: claim.acceptanceCriteria,
          hash: claim.contentHash,
        },
      });
    }
    for (const item of snapshot.activeEvidence) {
      const lane = timelineLaneForEvidence(item);
      list.push({
        id: `evidence:${item.id}`,
        lane,
        at: item.capturedAt,
        title: item.summary,
        status: evidenceTimelineStatus(item.relation),
        statusLabel:
          item.relation === "supports"
            ? "Supports"
            : item.relation === "contradicts"
              ? "Contradicts"
              : "Missing evidence",
        claimId: claimIdByEvidenceId.get(item.id),
        detail: {
          kind: `${item.evidenceKind} evidence`,
          relation: item.relation,
          path: item.sourceMetadata?.path,
          revision: item.sourceMetadata?.revision,
          confidence: item.sourceMetadata?.confidence,
          excerpt: item.payloadSnapshot?.content,
          hash: item.contentHash,
          author: item.authorName,
        },
      });
    }
    for (const decision of snapshot.activeDecisions) {
      list.push({
        id: `decision:${decision.id}`,
        lane: "decision",
        at: decision.createdAt,
        title:
          decision.type === "assignment"
            ? `Assigned to ${decision.assignee?.displayName || "a teammate"}`
            : `${decision.type.replace("_", " ")} · ${decision.status}`,
        status: decisionTimelineStatus(decision),
        statusLabel:
          decision.type === "assignment"
            ? "Assigned"
            : decision.status === "approved"
              ? "Approved"
              : decision.status === "rejected"
                ? "Rejected"
                : decision.status === "revoked"
                  ? "Revoked"
                  : "Pending",
        claimId: decision.claimId,
        detail: {
          kind: decision.type === "assignment" ? "blocker assignment" : "human decision",
          excerpt: decision.rationale,
          author: decision.actor?.displayName,
          owner: decision.assignee?.displayName,
          role: decision.roleAtDecision,
        },
      });
    }
    for (const run of snapshot.verdictRuns) {
      list.push({
        id: `verdict:${run.id}`,
        lane: "decision",
        at: run.createdAt,
        title: `Server verdict · ${run.result?.label || "unknown"}`,
        status: run.result?.status === "go" ? "verified" : run.result?.status === "no_go" ? "contradicted" : "pending",
        statusLabel: run.result?.label || "Unknown",
        detail: {
          kind: "deterministic verdict run",
          excerpt: run.result?.detail,
          author: run.actor?.displayName,
        },
      });
    }
    return list.sort((left, right) => Date.parse(left.at) - Date.parse(right.at));
  }, [snapshot]);

  const claimOwners = useMemo(() => {
    const owners = new Map();
    for (const decision of snapshot.activeDecisions) {
      if (decision.type !== "assignment" || !decision.claimId) continue;
      const current = owners.get(decision.claimId);
      if (!current || Date.parse(decision.createdAt) > Date.parse(current.at)) {
        owners.set(decision.claimId, {
          name: decision.assignee?.displayName || "Unknown teammate",
          at: decision.createdAt,
        });
      }
    }
    return owners;
  }, [snapshot.activeDecisions]);

  const days = useMemo(
    () => [...new Set(events.map((event) => timelineDayKey(event.at)))].sort(),
    [events],
  );
  const [selectedId, setSelectedId] = useState(null);
  const boardRef = useRef(null);
  useEffect(() => {
    setSelectedId(null);
    // The newest day carries the release-blocking events; keep it in view.
    boardRef.current?.scrollTo({ left: boardRef.current.scrollWidth });
  }, [snapshot.release.id]);
  const selected =
    events.find((event) => event.id === selectedId) ||
    events.findLast((event) => event.status === "contradicted") ||
    events.at(-1) ||
    null;

  useEffect(() => {
    if (!focusClaimId) return;
    const target =
      events.findLast(
        (event) => event.claimId === focusClaimId && event.status === "contradicted",
      ) || events.findLast((event) => event.claimId === focusClaimId);
    if (target) {
      setSelectedId(target.id);
      boardRef.current
        ?.querySelector(`[data-event-id="${target.id}"]`)
        ?.scrollIntoView({ inline: "center", block: "nearest" });
    }
    onFocusHandled?.();
  }, [focusClaimId, events, onFocusHandled]);

  const [assessing, setAssessing] = useState(false);
  const [assessment, setAssessment] = useState(null);
  const [assessError, setAssessError] = useState("");
  useEffect(() => {
    setAssessment(null);
    setAssessError("");
  }, [selected?.id]);

  async function runAssessment() {
    const payload = buildAnalysisPayload(selected, snapshot);
    if (!payload) return;
    setAssessing(true);
    setAssessError("");
    try {
      const result = await api("/api/analyze", {
        method: "POST",
        marker: "analyze",
        body: payload,
        timeoutMs: 30_000,
      });
      setAssessment(result);
    } catch (requestError) {
      setAssessError(requestError.message);
    } finally {
      setAssessing(false);
    }
  }

  if (events.length === 0) {
    return (
      <EmptyState
        icon={ClockCounterClockwise}
        title="Nothing on the timeline yet"
        body="Attach evidence or record a decision and the release history appears here."
      />
    );
  }

  return (
    <div className="rt-timeline">
      <TimelineBoard
        boardRef={boardRef}
        days={days.map((day) => ({
          key: day,
          label: formatTimelineDay(day),
          title: formatFullTimestamp(`${day}T00:00:00Z`),
        }))}
        events={events.map((event) => ({
          id: event.id,
          lane: event.lane,
          status: event.status,
          title: event.title,
          dayKey: timelineDayKey(event.at),
          time: formatTime(event.at),
          timeTitle: formatFullTimestamp(event.at),
        }))}
        selectedId={selected?.id}
        onSelect={setSelectedId}
      />
      {selected && (
        <TimelineDetail
          selected={selected}
          claimOwners={claimOwners}
          capturedLabel={formatDate(selected.at)}
          capturedTitle={formatFullTimestamp(selected.at)}
        >
          {selected.claimId && (
            <AIAssessment
              assessing={assessing}
              assessError={assessError}
              assessment={assessment}
              onAssess={runAssessment}
            />
          )}
        </TimelineDetail>
      )}
    </div>
  );
}
