"use client";

import { useMemo, useState } from "react";
import {
  ArrowClockwise,
  BracketsCurly,
  CheckCircle,
  ClipboardText,
  ClockCounterClockwise,
  Database,
  DownloadSimple,
  RocketLaunch,
  ShieldCheck,
  SpinnerGap,
  WarningCircle,
  XCircle,
} from "@phosphor-icons/react";
import { Badge } from "../components/core/Badge.jsx";
import { Button } from "../components/core/Button.jsx";
import { Kicker } from "../components/core/Kicker.jsx";
import { StateChip } from "../components/core/StateChip.jsx";
import { Dialog } from "../components/feedback/Dialog.jsx";
import { EmptyState } from "../components/feedback/EmptyState.jsx";
import { VerdictBanner } from "../components/feedback/VerdictBanner.jsx";
import { MetricCard } from "../components/feedback/MetricCard.jsx";
import { VerdictHistory } from "../components/feedback/VerdictHistory.jsx";
import { RecordSection } from "../components/records/RecordSection.jsx";
import { RecordCard } from "../components/records/RecordCard.jsx";
import { AuditTrail } from "../components/records/AuditTrail.jsx";
import { Tabs } from "../components/navigation/Tabs.jsx";
import { TimelineTab } from "./TimelineTab.jsx";
import { can } from "../lib/rbac.js";
import { formatDate, formatFullTimestamp } from "../lib/format.js";
import { byBlockingPriority } from "../lib/timeline-logic.js";
import { humanizeAuditAction } from "../lib/audit.js";
import { AUDIT_TARGET_TAB } from "../lib/audit-constants.js";
import { isAllowedSourceUrl } from "../lib/source-url.js";

export function ReleaseWorkspace({
  snapshot,
  onRefresh,
  onCreate,
  onUpdateStatus,
  onRunVerdict,
  onGenerateExport,
}) {
  const [tab, setTab] = useState(() =>
    snapshot.activeEvidence.length || snapshot.activeDecisions.length
      ? "timeline"
      : "overview",
  );
  const [focusClaimId, setFocusClaimId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const role = snapshot.membership.role;
  const latestRun = snapshot.verdictRuns.at(-1) || null;
  const verdictStatus = latestRun?.result?.status || "not_run";
  const verdictLabel = latestRun?.result?.label || "NOT RUN";
  const blockingClaims = latestRun?.result?.blockingClaims || [];

  function jumpToBlocker(claimId) {
    setTab("timeline");
    setFocusClaimId(claimId);
  }
  const VerdictIcon =
    verdictStatus === "go"
      ? CheckCircle
      : verdictStatus === "no_go"
        ? XCircle
        : WarningCircle;
  const claimLinks = useMemo(() => {
    const counts = new Map();
    for (const link of snapshot.links) {
      counts.set(link.claimId, (counts.get(link.claimId) || 0) + 1);
    }
    return counts;
  }, [snapshot.links]);

  async function changeStatus(status) {
    setBusy(true);
    setActionError("");
    try {
      await onUpdateStatus(status);
    } catch (requestError) {
      setActionError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function runVerdict() {
    setBusy(true);
    setActionError("");
    try {
      await onRunVerdict();
    } catch (requestError) {
      setActionError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function generateExport() {
    setBusy(true);
    setActionError("");
    try {
      await onGenerateExport();
    } catch (requestError) {
      setActionError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  const [confirmExport, setConfirmExport] = useState(false);
  function requestExport() {
    if (verdictStatus === "go") {
      generateExport();
    } else {
      setConfirmExport(true);
    }
  }

  const tabs = [
    ["timeline", "Timeline"],
    ["overview", "Overview"],
    ["claims", `Claims ${snapshot.activeClaims.length}`],
    ["evidence", `Evidence ${snapshot.activeEvidence.length}`],
    ["decisions", `Decisions ${snapshot.activeDecisions.length}`],
    ["audit", "Audit"],
  ];

  return (
    <div className="rt-release">
      <header className="rt-release-head">
        <div>
          <p className="rt-breadcrumb">
            {snapshot.release.workspace.name} <span>/</span> {snapshot.release.project.name}
          </p>
          <div className="rt-release-title">
            <span className="rt-release-icon"><RocketLaunch /></span>
            <div>
              <h1>{snapshot.release.name}</h1>
              <p>{snapshot.release.description || "No release description yet."}</p>
            </div>
          </div>
        </div>
        <div className="rt-release-actions">
          <Badge status={snapshot.release.status}>
            <ClockCounterClockwise weight="fill" /> Workflow: {snapshot.release.status.replace("_", " ")}
          </Badge>
          <Button type="button" variant="secondary" onClick={onRefresh}>
            <ArrowClockwise /> Refresh
          </Button>
          {can(role, "run_verdict") && (
            <Button
              type="button"
              variant="primary"
              onClick={runVerdict}
              disabled={busy}
            >
              <ShieldCheck /> Run verdict
            </Button>
          )}
          {can(role, "generate_export") && latestRun && (
            <Button
              type="button"
              variant="secondary"
              onClick={requestExport}
              disabled={busy}
              title="Certifies the record's integrity, not release readiness."
            >
              <DownloadSimple /> Export signed {verdictLabel} record
            </Button>
          )}
          {can(role, "manage_release") && snapshot.release.status !== "finalized" && (
            <Button
              type="button"
              variant="primary"
              onClick={() => changeStatus("finalized")}
              disabled={busy}
            >
              <CheckCircle /> Finalize
            </Button>
          )}
          {can(role, "manage_release") && snapshot.release.status === "finalized" && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => changeStatus("in_review")}
              disabled={busy}
            >
              Reopen review
            </Button>
          )}
        </div>
      </header>
      <VerdictBanner
        status={verdictStatus}
        label={verdictLabel}
        icon={VerdictIcon}
        latestRunAt={latestRun ? formatDate(latestRun.createdAt) : null}
        blockers={blockingClaims}
        onBlockerClick={jumpToBlocker}
      />
      {actionError && <p className="rt-error rt-release-error" role="alert"><WarningCircle /> {actionError}</p>}

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      <section className="rt-release-content" role="tabpanel" id={`release-panel-${tab}`} aria-labelledby={`release-tab-${tab}`}>
        {tab === "timeline" && (
          <TimelineTab
            snapshot={snapshot}
            focusClaimId={focusClaimId}
            onFocusHandled={() => setFocusClaimId(null)}
          />
        )}
        {tab === "overview" && (
          <>
            <div className="rt-metrics">
              <MetricCard label="Material claims" value={snapshot.activeClaims.filter((claim) => claim.material).length} hint="Authoritative snapshots" />
              <MetricCard label="Evidence records" value={snapshot.activeEvidence.length} hint={`${snapshot.links.length} claim links`} />
              <MetricCard label="Human decisions" value={snapshot.activeDecisions.length} hint="Append-only review log" />
              <MetricCard tone={verdictStatus} label="Server verdict" value={<><VerdictIcon weight="fill" /> {verdictLabel}</>} hint={latestRun ? formatDate(latestRun.createdAt) : "No stored verdict run"} />
            </div>
            <div className="rt-overview-grid">
              <article className="rt-trust-card">
                <div>
                <Kicker>Trust boundary</Kicker>
                  <h2>Browser state is not authority.</h2>
                  <p>
                    Claims, evidence, decisions, roles, audit events, and verdict
                    runs are read from the shared database on every refresh.
                  </p>
                </div>
                <Database weight="duotone" />
              </article>
              <article className="rt-target-card">
                <span>Release target</span>
                <strong>
                  {snapshot.release.targetType === "unspecified"
                    ? "Not specified"
                    : `${snapshot.release.targetType}: ${snapshot.release.targetValue}`}
                </strong>
                <p>Created {formatDate(snapshot.release.createdAt)}</p>
                <p>Workspace role: <b>{role}</b></p>
              </article>
            </div>
            {snapshot.activeClaims.length === 0 && (
              <EmptyState
                icon={ClipboardText}
                title="Start with a material claim"
                body="Describe what must be true for this release, then attach current evidence."
                action={can(role, "create_claim") ? () => onCreate("claim") : null}
                actionLabel="Add first claim"
              />
            )}
          </>
        )}

        {tab === "claims" && (
          <RecordSection
            title="Release claims"
            description="Immutable statements the team must prove before shipping."
            action={can(role, "create_claim") ? () => onCreate("claim") : null}
            actionLabel="Add claim"
          >
            {snapshot.activeClaims.length === 0 ? (
              <EmptyState icon={ClipboardText} title="No claims yet" body="Create the first release claim." />
            ) : (
              <div className="rt-record-list">
                {snapshot.activeClaims.map((claim) => (
                  <RecordCard key={claim.id} tone="claim" icon={<ClipboardText />}>
                    <div className="rt-record-title">
                      <h3>{claim.title}</h3>
                      {claim.material && <span>Material</span>}
                    </div>
                    <p>{claim.description}</p>
                    <dl>
                      <div><dt>Acceptance</dt><dd>{claim.acceptanceCriteria}</dd></div>
                      <div><dt>Needs</dt><dd>{claim.requiredEvidenceKinds.join(", ")}</dd></div>
                    </dl>
                    <small>
                      {claimLinks.get(claim.id) || 0} linked evidence · hash {claim.contentHash.slice(0, 12)}…
                    </small>
                  </RecordCard>
                ))}
              </div>
            )}
          </RecordSection>
        )}

        {tab === "evidence" && (
          <RecordSection
            title="Evidence ledger"
            description="Source snapshots are content-addressed and cannot be edited in place."
            action={
              can(role, "create_evidence") && snapshot.activeClaims.length > 0
                ? () => onCreate("evidence")
                : null
            }
            actionLabel="Add evidence"
          >
            {snapshot.activeEvidence.length === 0 ? (
              <EmptyState
                icon={BracketsCurly}
                title="No evidence yet"
                body={
                  snapshot.activeClaims.length === 0
                    ? "Create a claim before linking evidence."
                    : "Attach a manual source snapshot to one or more claims."
                }
                action={can(role, "create_evidence") && snapshot.activeClaims.length > 0 ? () => onCreate("evidence") : null}
                actionLabel="Add evidence"
              />
            ) : (
              <>
                {(() => {
                  const contradicting = snapshot.activeEvidence.filter(
                    (item) => item.relation === "contradicts",
                  ).length;
                  return contradicting > 0 ? (
                    <p className="rt-evidence-summary">
                      <WarningCircle weight="fill" /> {contradicting}{" "}
                      {contradicting === 1 ? "blocking contradiction" : "blocking contradictions"}{" "}
                      shown first.
                    </p>
                  ) : null;
                })()}
              <div className="rt-record-list">
                {[...snapshot.activeEvidence].sort(byBlockingPriority).map((item) => (
                  <RecordCard key={item.id} tone={item.relation} icon={item.relation === "supports" ? <CheckCircle /> : <WarningCircle />}>
                    <div className="rt-record-title">
                      <h3>{item.summary}</h3>
                      <StateChip state={item.relation}>{item.relation}</StateChip>
                    </div>
                    <dl>
                      <div><dt>Kind</dt><dd>{item.evidenceKind}</dd></div>
                      <div><dt>Captured</dt><dd>{formatDate(item.capturedAt)}</dd></div>
                    </dl>
                    {isAllowedSourceUrl(item.sourceUrl) && (
                      <a href={item.sourceUrl} target="_blank" rel="noreferrer">Open source</a>
                    )}
                    <small>hash {item.contentHash.slice(0, 12)}…</small>
                  </RecordCard>
                ))}
              </div>
              </>
            )}
          </RecordSection>
        )}

        {tab === "decisions" && (
          <RecordSection
            title="Review decisions"
            description="Every review is attributed to an authenticated workspace member."
            action={
              can(role, "create_decision") &&
              snapshot.activeClaims.length > 0 &&
              snapshot.activeEvidence.length > 0
                ? () => onCreate("decision")
                : null
            }
            actionLabel="Record decision"
          >
            {snapshot.activeDecisions.length === 0 ? (
              <EmptyState
                icon={ShieldCheck}
                title="No decisions yet"
                body="Decision recording is available to reviewers after evidence has been attached."
              />
            ) : (
              <div className="rt-record-list">
                {snapshot.activeDecisions.map((decision) => (
                  <RecordCard key={decision.id} tone="decision" icon={<ShieldCheck />}>
                    <div className="rt-record-title">
                      <h3>{decision.type.replace("_", " ")}</h3>
                      <span>{decision.status}</span>
                    </div>
                    <p>{decision.rationale}</p>
                    <small>{decision.actor.displayName} · {formatDate(decision.createdAt)}</small>
                  </RecordCard>
                ))}
              </div>
            )}
          </RecordSection>
        )}

        {tab === "audit" && (
          <>
            {snapshot.verdictRuns.length > 0 && (
              <RecordSection
                title="Verdict history"
                description="Every server-computed verdict for this release, in order."
              >
                <VerdictHistory
                  runs={snapshot.verdictRuns.map((run) => ({
                    id: run.id,
                    status: run.result?.status || "not_run",
                    label: run.result?.label || "UNKNOWN",
                    at: formatDate(run.createdAt),
                  }))}
                />
              </RecordSection>
            )}
            <RecordSection
            title="Tamper-evident audit"
            description="Each event includes the hash of the previous workspace event."
          >
            {snapshot.auditEvents.length === 0 ? (
              <EmptyState
                icon={ClockCounterClockwise}
                title="No audit events yet"
                body="Record activity will appear here with its tamper-evident hash chain."
              />
            ) : (
            <AuditTrail
              events={[...snapshot.auditEvents].reverse().map((event) => ({
                id: event.id,
                actorName: event.actor?.displayName || "A workspace member",
                actionText: humanizeAuditAction(event.action),
                fullTimestamp: formatFullTimestamp(event.createdAt),
                dateText: formatDate(event.createdAt),
                hashText: event.eventHash.slice(0, 12),
                targetTab: AUDIT_TARGET_TAB[event.targetType],
              }))}
              onJump={setTab}
            />
            )}
          </RecordSection>
          </>
        )}
      </section>
      {confirmExport && (
        <Dialog
          title={`Export signed ${verdictLabel} record?`}
          eyebrow="Not a ship decision"
          onClose={() => setConfirmExport(false)}
        >
          <p className="rt-confirm-body">
            This Ed25519 signature certifies that the exported claims,
            evidence, and decisions match the stored record exactly — it is
            an integrity proof, not permission to ship. The current server
            verdict is <strong>{verdictLabel}</strong>.
          </p>
          <div className="rt-dialog-actions">
            <Button type="button" variant="secondary" onClick={() => setConfirmExport(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={busy}
              onClick={() => {
                setConfirmExport(false);
                generateExport();
              }}
            >
              {busy ? <SpinnerGap className="rt-spin" /> : <DownloadSimple />} Export anyway
            </Button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
