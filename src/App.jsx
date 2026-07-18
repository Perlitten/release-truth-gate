"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowSquareOut,
  BracketsCurly,
  CalendarBlank,
  CaretRight,
  Check,
  ClipboardText,
  ClockCounterClockwise,
  Code,
  DownloadSimple,
  FileText,
  GitDiff,
  HourglassMedium,
  Info,
  Key,
  ListChecks,
  LockKey,
  MagnifyingGlass,
  Pulse,
  Question,
  Robot,
  ShareNetwork,
  ShieldCheck,
  Sparkle,
  SpinnerGap,
  UsersThree,
  Warning,
  X,
} from "@phosphor-icons/react";
import {
  allEvents,
  buildAnalysisPayloadForEvent,
  claims,
  eventById,
  evidenceSources,
  initialDecisions,
  lanes,
  release,
} from "./data.js";
import {
  appendDecision,
  calculateVerdict,
  createDecisionRecord,
  deriveFindings,
} from "./lib/verdict.js";
import {
  buildShareUrl,
  createEvidenceExport,
  LOCAL_DRAFT_KEY,
  sanitizePortableState,
  SNAPSHOT_VERSION,
  stateFromLocationHash,
} from "./lib/snapshot.js";

const laneIcons = {
  claim: ClipboardText,
  code: Code,
  tests: ListChecks,
  decisions: UsersThree,
};

const navItems = [
  { id: "timeline", label: "Release Timeline", icon: Pulse },
  { id: "summary", label: "Summary", icon: FileText },
  { id: "evidence", label: "Evidence", icon: BracketsCurly },
  { id: "risks", label: "Risks", icon: Warning },
  { id: "decisions", label: "Decisions", icon: ShieldCheck },
];

function statusLabel(status) {
  return (
    {
      verified: "Verified",
      contradicted: "Contradicted",
      pending: "Pending",
      superseded: "Superseded",
      unproven: "Unproven",
    }[status] || "Unknown"
  );
}

function formatUtcTimestamp(value) {
  return `${new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value))} UTC`;
}

function StatusMark({ status, compact = false }) {
  const config = {
    verified: { label: "Verified", Icon: Check },
    contradicted: { label: "Contradicted", Icon: X },
    pending: { label: "Pending", Icon: HourglassMedium },
    superseded: { label: "Superseded", Icon: CaretRight },
    unproven: { label: "Unproven", Icon: Question },
  }[status] || { label: "Unknown", Icon: Question };
  const safeStatus = config.label === "Unknown" ? "unproven" : status;

  return (
    <span
      className={`status-mark ${safeStatus} ${compact ? "compact" : ""}`}
      aria-label={config.label}
    >
      <config.Icon weight="bold" />
    </span>
  );
}

function Header({ verdict, onShare, onExport }) {
  return (
    <>
      <header className="app-header">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">
            <Sparkle weight="fill" />
          </span>
          <div>
            <p className="eyebrow">Release Truth</p>
            <h1>{release.name}</h1>
          </div>
        </div>

        <div className={`verdict-badge ${verdict.status}`}>
          <span>{verdict.label}</span>
          <small>{verdict.detail}</small>
        </div>

        <div className="release-date">
          <CalendarBlank />
          <div>
            <span>Launch date</span>
            <strong>{release.date}</strong>
          </div>
        </div>

        <div className="today-date">
          <ClockCounterClockwise />
          <span>
            Snapshot <strong>{release.snapshotDate}</strong>
          </span>
        </div>
      </header>

      <div className="mobile-action-bar">
        <button type="button" onClick={onShare}>
          <ShareNetwork /> Share snapshot
        </button>
        <button type="button" onClick={onExport}>
          <DownloadSimple /> Export evidence
        </button>
      </div>
    </>
  );
}

function Navigation({ activeTab, onChange, onShare, onExport }) {
  return (
    <nav className="main-nav" aria-label="Release sections">
      <div className="nav-scroll">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              type="button"
              className={activeTab === item.id ? "active" : ""}
              onClick={() => onChange(item.id)}
              aria-label={item.label}
              aria-current={activeTab === item.id ? "page" : undefined}
              key={item.id}
            >
              <Icon />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
      <div className="nav-actions">
        <span className="dataset-label">{release.datasetLabel}</span>
        <button type="button" onClick={onShare}>
          <ShareNetwork /> Share
        </button>
        <button type="button" onClick={onExport}>
          <DownloadSimple /> Export
        </button>
      </div>
    </nav>
  );
}

function Timeline({ selectedId, onSelect, onExplain }) {
  const eventRefs = useRef(new Map());
  const timelineRef = useRef(null);

  useEffect(() => {
    if (!selectedId || !window.matchMedia("(max-width: 1180px)").matches) return;
    const eventNode = eventRefs.current.get(selectedId);
    const timelineNode = timelineRef.current;
    if (!eventNode || !timelineNode) return;
    timelineNode.scrollTo({
      left:
        eventNode.offsetLeft -
        timelineNode.clientWidth +
        eventNode.clientWidth +
        24,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  }, [selectedId]);

  return (
    <section ref={timelineRef} className="timeline" aria-label="Evidence timeline">
      <p className="timeline-scroll-hint">
        Scroll horizontally to follow the current evidence head.
      </p>
      <div className="timeline-head">
        <div className="month-label">
          <span>July 2026</span>
          <small>Fixed evidence window</small>
        </div>
        {release.days.map((day) => (
          <div className={`day-heading ${day.current ? "today" : ""}`} key={day.id}>
            <span>{day.weekday}</span>
            <strong>{day.date}</strong>
            {day.current && <small>Snapshot</small>}
          </div>
        ))}
      </div>

      {lanes.map((lane) => {
        const LaneIcon = laneIcons[lane.id];
        return (
          <div className="lane-row" key={lane.id}>
            <div className="lane-label">
              <span className="lane-icon">
                <LaneIcon weight="bold" />
              </span>
              <div>
                <strong>{lane.label}</strong>
                <small>{lane.description}</small>
              </div>
            </div>
            {lane.events.map((event, index) => (
              <button
                type="button"
                ref={(node) => {
                  if (node) eventRefs.current.set(event.id, node);
                  else eventRefs.current.delete(event.id);
                }}
                className={[
                  "timeline-event",
                  event.status,
                  selectedId === event.id ? "selected" : "",
                  release.days[index].current ? "current-day" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                key={event.id}
                onClick={() => onSelect(event.id)}
                aria-pressed={selectedId === event.id}
                aria-label={`${lane.label}, ${release.days[index].weekday} ${
                  release.days[index].date
                }: ${event.title.replaceAll("\n", " ")}, ${statusLabel(event.status)}`}
              >
                <span className="event-track" aria-hidden="true" />
                <StatusMark status={event.status} />
                <span className="event-title">
                  {event.title.split("\n").map((line) => (
                    <span key={line}>{line}</span>
                  ))}
                </span>
                <span className="event-revision">{event.revision}</span>
                <span className="event-time">{event.time}</span>
              </button>
            ))}
          </div>
        );
      })}

      <div className="legend">
        {[
          ["verified", "Evidence supports the claim"],
          ["contradicted", "Current evidence conflicts"],
          ["pending", "Awaiting verification"],
          ["unproven", "No proof for this state"],
          ["superseded", "Replaced by a newer revision"],
        ].map(([status, description]) => (
          <div key={status}>
            <StatusMark status={status} compact />
            <span>
              <strong>{statusLabel(status)}</strong>
              <small>{description}</small>
            </span>
          </div>
        ))}
        <button type="button" className="how-it-works" onClick={onExplain}>
          How the gate works <Info />
        </button>
      </div>
    </section>
  );
}

function CodeExcerpt({ event, showDiff }) {
  if (!event.excerpt) return null;

  return (
    <div className="detail-section">
      <h4>
        Source excerpt <span>({event.source})</span>
      </h4>
      <div className={`code-excerpt ${showDiff ? "show-diff" : ""}`}>
        {showDiff && event.previousExcerpt && (
          <>
            <div className="diff-heading">
              Before · revision {event.previousRevision}
            </div>
            {event.previousExcerpt.map((line, index) => (
              <div className="removed-line" key={`before-${line}-${index}`}>
                <span>{142 + index}</span>
                <code>{line}</code>
              </div>
            ))}
            <div className="diff-heading">Current · revision b7e6c3d</div>
          </>
        )}
        {event.excerpt.map((line, index) => (
          <div
            className={showDiff ? "added-line" : ""}
            key={`current-${line}-${index}`}
          >
            <span>{142 + index}</span>
            <code>{line}</code>
          </div>
        ))}
      </div>
    </div>
  );
}

function AssessmentCard({ entry }) {
  const { assessment } = entry;
  return (
    <div className={`ai-assessment relation-${assessment.relation}`}>
      <div className="ai-assessment-head">
        <span className="ai-label">
          <Robot weight="bold" /> Evidence analyst
        </span>
        <span className="live-label">LIVE · NOT STORED</span>
      </div>
      <strong>{assessment.headline}</strong>
      <p>{assessment.finding}</p>
      <div className="assessment-facts">
        <span>Relation: {assessment.relation}</span>
        <span>{Math.round(assessment.confidence * 100)}% model confidence</span>
      </div>
      <div className="citation-list">
        {assessment.evidence.map((citation) => (
          <blockquote key={`${citation.sourceId}-${citation.excerpt}`}>
            <span>
              {citation.sourceId} · {citation.relation}
            </span>
            “{citation.excerpt}”
          </blockquote>
        ))}
      </div>
      {assessment.missingEvidence.length > 0 && (
        <p>
          Missing: {assessment.missingEvidence.join("; ")}
        </p>
      )}
      <p className="recommended-action">
        Next: {assessment.recommendedAction}
      </p>
      <small title={entry.responseId}>
        {entry.model} · {formatUtcTimestamp(entry.analyzedAt)} · response{" "}
        {entry.responseId.slice(0, 16)}…
      </small>
    </div>
  );
}

function DetailPanel({
  event,
  issue,
  assessmentEntry,
  analysisError,
  isAnalyzing,
  analystAccess,
  onAnalyze,
  onReview,
  onClose,
}) {
  const [showDiff, setShowDiff] = useState(false);
  const canCompare = Boolean(event.previousExcerpt);
  const confidence = Number.isFinite(event.confidence)
    ? `${Math.round(event.confidence * 100)}%`
    : "Not measured";

  useEffect(() => {
    setShowDiff(false);
  }, [event.id]);

  const aiButtonLabel =
    analystAccess.status === "disabled"
      ? "AI review unavailable"
      : analystAccess.status === "locked"
        ? "Unlock live AI review"
        : isAnalyzing
          ? "Analyzing selected evidence…"
          : "Run live AI evidence review";

  return (
    <aside className={`detail-panel status-${event.status}`} aria-label="Selected event details">
      <div className="detail-topline">
        <div>
          <StatusMark status={event.status} compact />
          <span>Selected event</span>
        </div>
        <span>{release.snapshotDate} · {event.time}</span>
        <button type="button" className="panel-close" onClick={onClose} aria-label="Close details">
          <X />
        </button>
      </div>

      <h2>{event.headline || event.title.replaceAll("\n", " ")}</h2>
      <p className="detail-summary">{event.summary}</p>

      {issue && (
        <div className="issue-chip">
          One deduplicated issue · {issue.evidenceIds.length} current evidence sources
        </div>
      )}

      <dl className="detail-meta">
        <div>
          <dt>Lane</dt>
          <dd>{event.laneLabel}</dd>
        </div>
        <div>
          <dt>Evidence state</dt>
          <dd>{statusLabel(event.status)}</dd>
        </div>
        <div>
          <dt>Source</dt>
          <dd title={event.source}>{event.source}</dd>
        </div>
        <div>
          <dt>Revision</dt>
          <dd>{event.revision.replace("rev ", "")}</dd>
        </div>
        <div>
          <dt>Owner</dt>
          <dd title={event.owner}>{event.owner}</dd>
        </div>
        <div>
          <dt>Confidence</dt>
          <dd className="confidence">
            <span>{confidence}</span>
            {Number.isFinite(event.confidence) && (
              <span className="confidence-dots" aria-hidden="true">
                {[1, 2, 3, 4, 5].map((dot) => (
                  <i
                    key={dot}
                    className={dot <= Math.round(event.confidence * 5) ? "on" : ""}
                  />
                ))}
              </span>
            )}
          </dd>
        </div>
      </dl>

      <CodeExcerpt event={event} showDiff={showDiff} />

      {event.contradicts && (
        <div className="detail-section prose">
          <h4>Contradicts</h4>
          <p>{event.contradicts}</p>
        </div>
      )}

      {event.impact && (
        <div className="detail-section prose">
          <h4>Impact</h4>
          <p>{event.impact}</p>
        </div>
      )}

      {assessmentEntry && <AssessmentCard entry={assessmentEntry} />}
      {analysisError && (
        <div className="analysis-error" role="alert">
          <Warning weight="bold" />
          <span>
            <strong>Live AI review failed</strong>
            {analysisError}
          </span>
        </div>
      )}

      <div className="detail-controls">
        <div className="detail-actions">
          {issue && (
            <button type="button" className="primary" onClick={onReview}>
              <ShieldCheck /> Record review proposal
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowDiff((current) => !current)}
            disabled={!canCompare}
            title={canCompare ? undefined : "No previous source snapshot is attached"}
          >
            <GitDiff />{" "}
            {canCompare
              ? showDiff
                ? "Hide exact revisions"
                : "Compare exact revisions"
              : "No prior revision"}
          </button>
        </div>
        <button
          type="button"
          className="ai-action"
          onClick={onAnalyze}
          disabled={
            isAnalyzing ||
            analystAccess.status === "checking" ||
            analystAccess.status === "disabled" ||
            !buildAnalysisPayloadForEvent(event.id)
          }
        >
          {isAnalyzing ? <SpinnerGap className="spin" /> : <Sparkle weight="fill" />}
          {aiButtonLabel}
        </button>
        <p className="ai-authority-note">
          AI explains evidence relations. The deterministic policy engine owns the release verdict.
        </p>
      </div>
    </aside>
  );
}

function SummaryView({ verdict, findings, decisions, onOpenTimeline }) {
  const snapshotTime = Date.parse(release.snapshotISO);
  const launchTime = Date.parse(release.dateISO);
  const daysToLaunch = Math.max(
    0,
    Math.ceil((launchTime - snapshotTime) / (24 * 60 * 60 * 1000)),
  );
  const cards = [
    { label: "Distinct blocking issues", value: verdict.blockers, icon: X, tone: "red" },
    {
      label: "Pending decision records",
      value: decisions.filter((item) => item.status === "pending").length,
      icon: HourglassMedium,
      tone: "amber",
    },
    {
      label: "Current evidence sources",
      value: evidenceSources.length,
      icon: BracketsCurly,
      tone: "teal",
    },
    { label: "Days to launch", value: daysToLaunch, icon: CalendarBlank, tone: "navy" },
  ];

  return (
    <section className="section-view">
      <div className="section-heading">
        <div>
          <span className="section-kicker">Release state</span>
          <h2>Launch confidence at a glance</h2>
          <p>
            Metrics are derived from the current claim graph, not hardcoded display values.
          </p>
        </div>
        <button type="button" className="primary" onClick={onOpenTimeline}>
          Open timeline <ArrowSquareOut />
        </button>
      </div>
      <div className="metric-grid">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <article className={`metric-card ${card.tone}`} key={card.label}>
              <Icon />
              <strong>{card.value}</strong>
              <span>{card.label}</span>
            </article>
          );
        })}
      </div>
      <article className={`verdict-card ${verdict.status}`}>
        <div>
          <span>Deterministic current verdict</span>
          <h3>{verdict.label}</h3>
          <p>{verdict.detail}. Human proposals never rewrite source evidence.</p>
          <div className="truth-chain" aria-label="Truth model">
            <b>Claim</b>
            <CaretRight />
            <b>Evidence</b>
            <CaretRight />
            <b>{findings.length} issue</b>
            <CaretRight />
            <b>Decision log</b>
          </div>
        </div>
        <LockKey weight="duotone" />
      </article>
    </section>
  );
}

function ListView({ type, findings, decisions, onSelect }) {
  const [query, setQuery] = useState("");
  const lowerQuery = query.trim().toLowerCase();

  const items = useMemo(() => {
    if (type === "evidence") {
      return evidenceSources.map((source) => {
        const event = allEvents
          .filter((candidate) => candidate.evidenceId === source.id)
          .sort((left, right) => right.timestamp.localeCompare(left.timestamp))[0];
        return {
          id: source.id,
          title: source.title,
          meta: `${source.path} · ${source.revision} · ${source.updatedAt}`,
          status:
            source.relation === "supports"
              ? "verified"
              : source.relation === "contradicts"
                ? "contradicted"
                : source.relation === "supersedes"
                  ? "superseded"
                  : "unproven",
          eventId: event?.id || null,
        };
      });
    }
    if (type === "risks") {
      return findings.map((finding) => ({
        id: finding.id,
        title: finding.title,
        meta: `${finding.riskType} · ${finding.evidenceIds.length} evidence sources · ${
          finding.staleDecisionIds.length
        } stale approvals`,
        status: finding.status,
        eventId:
          allEvents.find((event) => event.issueId === finding.id)?.id || null,
      }));
    }
    return [...decisions]
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .map((decision) => ({
        id: decision.id,
        title: `${decision.type.replaceAll("_", " ")} · ${decision.actor}`,
        meta: `${formatUtcTimestamp(decision.createdAt)} · ${
          decision.evidenceHead
        } · ${decision.reason}`,
        status: decision.status === "approved" ? "verified" : "pending",
        eventId:
          allEvents.find(
            (event) =>
              event.issueId === decision.issueId ||
              event.decisionId === decision.id,
          )?.id || null,
      }));
  }, [decisions, findings, type]);

  const visibleItems = items.filter((item) =>
    `${item.title} ${item.meta}`.toLowerCase().includes(lowerQuery),
  );
  const copy = {
    evidence: {
      kicker: "Source registry",
      title: "Evidence with exact revisions",
      description: "Each source is listed once with its current claim relation.",
    },
    risks: {
      kicker: "Deduplicated review queue",
      title: "Issues that change the gate",
      description: "Related claim, code, and test events resolve to one causal issue.",
    },
    decisions: {
      kicker: "Append-only local demo log",
      title: "Decision history",
      description:
        "Records preserve actor, reason, evidence head, scope, and time. Server signing remains required for production governance.",
    },
  }[type];

  return (
    <section className="section-view">
      <div className="section-heading">
        <div>
          <span className="section-kicker">{copy.kicker}</span>
          <h2>{copy.title}</h2>
          <p>{copy.description}</p>
        </div>
        <label className="search-field">
          <MagnifyingGlass />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label={`Search ${type}`}
            placeholder={`Search ${type}`}
          />
        </label>
      </div>
      <div className="evidence-list">
        {visibleItems.length > 0 ? (
          visibleItems.map((item) => (
            <button
              type="button"
              onClick={() => item.eventId && onSelect(item.eventId)}
              disabled={!item.eventId}
              key={item.id}
            >
              <StatusMark status={item.status} compact />
              <span className="list-copy">
                <strong>{item.title}</strong>
                <small>{item.meta}</small>
              </span>
              <span className={`status-pill ${item.status}`}>
                {statusLabel(item.status)}
              </span>
              <CaretRight />
            </button>
          ))
        ) : (
          <p className="empty-state">No records match “{query}”.</p>
        )}
      </div>
    </section>
  );
}

function Dialog({ title, description, onClose, children, initialFocusRef }) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const panel = panelRef.current;
    const focusable = () =>
      Array.from(
        panel?.querySelectorAll(
          'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [href]',
        ) || [],
      );
    (initialFocusRef?.current || focusable()[0] || panel)?.focus();

    function onKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [initialFocusRef, onClose]);

  return (
    <div
      className="dialog-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        ref={panelRef}
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
      >
        <div className="dialog-head">
          <div>
            <h2 id={titleId}>{title}</h2>
            <p id={descriptionId}>{description}</p>
          </div>
          <button type="button" onClick={onClose} aria-label={`Close ${title}`}>
            <X />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

function ReviewDialog({ issue, actor, onClose, onSubmit }) {
  const [action, setAction] = useState("supersession_proposal");
  const [reason, setReason] = useState("");
  const reasonRef = useRef(null);

  return (
    <Dialog
      title="Record a review proposal"
      description="This appends a scoped decision record. It does not change evidence, confidence, or the current blocker."
      onClose={onClose}
      initialFocusRef={reasonRef}
    >
      <form
        className="review-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit({ action, reason });
        }}
      >
        <label>
          Decision type
          <select value={action} onChange={(event) => setAction(event.target.value)}>
            <option value="supersession_proposal">Propose a replacement claim</option>
            <option value="risk_waiver_request">Request a time-bounded risk waiver</option>
          </select>
        </label>
        <label>
          Actor
          <input value={actor} readOnly />
        </label>
        <label>
          Reason
          <textarea
            ref={reasonRef}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            minLength={12}
            maxLength={800}
            rows={4}
            required
            placeholder="State why this proposal is needed and what evidence must change."
          />
        </label>
        <div className="decision-scope">
          <strong>Scope</strong>
          <span>{issue.id}</span>
          <small>{issue.evidenceIds.join(" · ")}</small>
        </div>
        <div className="dialog-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary">
            Append proposal
          </button>
        </div>
      </form>
    </Dialog>
  );
}

function AccessDialog({ onClose, onAuthenticated }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const codeRef = useRef(null);

  async function submit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/session", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "X-Release-Truth-Request": "session",
        },
        body: JSON.stringify({ accessCode: code }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Access failed.");
      onAuthenticated(payload.actor);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      title="Unlock live AI review"
      description="Enter the judge or team access code. The code is exchanged for an HttpOnly, same-site session cookie."
      onClose={onClose}
      initialFocusRef={codeRef}
    >
      <form className="review-form" onSubmit={submit}>
        <label>
          Access code
          <input
            ref={codeRef}
            type="password"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            minLength={4}
            maxLength={160}
            autoComplete="current-password"
            required
          />
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="dialog-actions">
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="submit" className="primary" disabled={submitting}>
            <Key /> {submitting ? "Checking…" : "Unlock"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

function ShareDialog({ url, onClose, onToast }) {
  const inputRef = useRef(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      onToast("Portable snapshot link copied", "success");
    } catch {
      inputRef.current?.select();
      onToast("Clipboard access failed. Copy the selected link manually.", "error");
    }
  }

  return (
    <Dialog
      title="Share a portable demo snapshot"
      description="The validated state is stored in the URL fragment and is not sent to the server. It is portable, but not a server-signed audit record."
      onClose={onClose}
      initialFocusRef={inputRef}
    >
      <div className="share-field">
        <input ref={inputRef} readOnly value={url} aria-label="Portable snapshot URL" />
        <button type="button" className="primary" onClick={copy}>
          <ClipboardText /> Copy link
        </button>
      </div>
    </Dialog>
  );
}

function HowItWorksDialog({ onClose }) {
  return (
    <Dialog
      title="How the release gate works"
      description="The verdict is deterministic. AI can explain relationships, but it cannot approve a launch or rewrite evidence."
      onClose={onClose}
    >
      <ol className="explanation-steps">
        <li><strong>Claim</strong><span>Define a material promise and its required evidence kinds.</span></li>
        <li><strong>Evidence</strong><span>Select the newest exact revision for claim, code, and test sources.</span></li>
        <li><strong>Issue</strong><span>Group related contradictions into one causal finding.</span></li>
        <li><strong>Decision</strong><span>Append actor, reason, scope, evidence head, time, and expiry without changing evidence.</span></li>
      </ol>
    </Dialog>
  );
}

function Toast({ toast }) {
  if (!toast) return null;
  const Icon = toast.tone === "error" ? Warning : Check;
  return (
    <div className={`toast ${toast.tone}`} role={toast.tone === "error" ? "alert" : "status"}>
      <Icon weight="bold" />
      {toast.message}
    </div>
  );
}

function makePortableState(userDecisions) {
  return {
    version: SNAPSHOT_VERSION,
    releaseId: release.id,
    evidenceHead: release.evidenceHead,
    decisions: userDecisions,
    assessments: {},
    savedAt: new Date().toISOString(),
  };
}

export function App() {
  const [activeTab, setActiveTab] = useState("timeline");
  const [selectedId, setSelectedId] = useState("privacy-conflict");
  const [userDecisions, setUserDecisions] = useState([]);
  const [assessments, setAssessments] = useState({});
  const [analysisErrors, setAnalysisErrors] = useState({});
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [loadedSnapshot, setLoadedSnapshot] = useState(false);
  const [toast, setToast] = useState(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [howOpen, setHowOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [accessOpen, setAccessOpen] = useState(false);
  const [analystAccess, setAnalystAccess] = useState({
    status: "checking",
    actor: null,
  });

  const decisions = useMemo(
    () => [...initialDecisions, ...userDecisions],
    [userDecisions],
  );
  const findings = useMemo(
    () => deriveFindings({ claims, sources: evidenceSources, decisions }),
    [decisions],
  );
  const verdict = useMemo(
    () =>
      calculateVerdict({
        claims,
        sources: evidenceSources,
        decisions,
      }),
    [decisions],
  );
  const selectedEvent = selectedId ? eventById[selectedId] : null;
  const selectedIssue = selectedEvent
    ? findings.find(
        (finding) =>
          finding.id === selectedEvent.issueId ||
          (selectedEvent.claimId && finding.claimId === selectedEvent.claimId),
      )
    : null;

  useEffect(() => {
    const sharedState = stateFromLocationHash(window.location.hash);
    let savedState = null;
    try {
      savedState = sanitizePortableState(
        JSON.parse(window.localStorage.getItem(LOCAL_DRAFT_KEY) || "null"),
      );
    } catch {
      window.localStorage.removeItem(LOCAL_DRAFT_KEY);
    }
    const state = sharedState || savedState;
    if (state?.evidenceHead === release.evidenceHead) {
      setUserDecisions(state.decisions);
      setAssessments({});
      setLoadedSnapshot(Boolean(sharedState));
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(
      LOCAL_DRAFT_KEY,
      JSON.stringify(makePortableState(userDecisions)),
    );
  }, [hydrated, userDecisions]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/session", { credentials: "same-origin", cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error);
        if (cancelled) return;
        setAnalystAccess({
          status: !payload.enabled
            ? "disabled"
            : payload.authenticated || !payload.required
              ? "ready"
              : "locked",
          actor: payload.actor,
        });
      })
      .catch(() => {
        if (!cancelled) setAnalystAccess({ status: "disabled", actor: null });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function showToast(message, tone = "success") {
    setToast({ message, tone });
    window.setTimeout(() => setToast(null), tone === "error" ? 5_000 : 3_000);
  }

  function openEvent(eventId) {
    setSelectedId(eventId);
    setActiveTab("timeline");
  }

  function appendReviewProposal({ action, reason }) {
    try {
      const createdAt = new Date().toISOString();
      const record = createDecisionRecord({
        id: crypto.randomUUID(),
        action,
        actor: analystAccess.actor || release.reviewer,
        reason,
        issue: selectedIssue,
        evidenceHead: release.evidenceHead,
        createdAt,
        expiresAt:
          action === "risk_waiver_request"
            ? new Date(Date.parse(createdAt) + 24 * 60 * 60 * 1000).toISOString()
            : null,
      });
      setUserDecisions((current) => appendDecision(current, record));
      setReviewOpen(false);
      showToast("Proposal appended to the browser-local decision draft");
    } catch (error) {
      showToast(error.message, "error");
    }
  }

  async function analyzeEvidence() {
    if (!selectedEvent) return;
    if (analystAccess.status === "locked") {
      setAccessOpen(true);
      return;
    }
    const analysisPayload = buildAnalysisPayloadForEvent(selectedEvent.id);
    if (!analysisPayload) {
      showToast("This event has no analyzable claim context", "error");
      return;
    }

    setIsAnalyzing(true);
    setAnalysisErrors((current) => ({ ...current, [selectedEvent.id]: null }));
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "X-Release-Truth-Request": "analyze",
        },
        body: JSON.stringify(analysisPayload),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Live review failed.");
      setAssessments((current) => ({
        ...current,
        [selectedEvent.id]: {
          assessment: payload.assessment,
          mode: payload.mode,
          model: payload.model,
          responseId: payload.responseId,
          analyzedAt: payload.analyzedAt,
          evidenceHead: payload.evidenceHead,
        },
      }));
      showToast("Live AI relation review completed and grounded");
    } catch (error) {
      setAnalysisErrors((current) => ({
        ...current,
        [selectedEvent.id]: error.message,
      }));
      showToast("Live AI review failed; no fallback result was substituted", "error");
    } finally {
      setIsAnalyzing(false);
    }
  }

  function shareRelease() {
    try {
      setShareUrl(
        buildShareUrl(
          window.location.href,
          makePortableState(userDecisions),
        ),
      );
    } catch {
      showToast("The current snapshot is too large or invalid to share", "error");
    }
  }

  async function exportRelease() {
    try {
      const bundle = await createEvidenceExport({
        release,
        claims,
        evidenceSources,
        findings,
        decisions,
        assessments,
        verdict,
        exportedAt: new Date().toISOString(),
        persistence:
          "Portable browser demo snapshot; production requires authenticated server-side append-only storage.",
      });
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(bundle, null, 2)], {
          type: "application/json",
        }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = "nova-2.4-release-truth-evidence.json";
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      showToast("Full evidence bundle exported with a SHA-256 checksum");
    } catch {
      showToast("Evidence export failed validation", "error");
    }
  }

  return (
    <div className="app-shell">
      <Header verdict={verdict} onShare={shareRelease} onExport={exportRelease} />
      <Navigation
        activeTab={activeTab}
        onChange={setActiveTab}
        onShare={shareRelease}
        onExport={exportRelease}
      />

      {loadedSnapshot && (
        <div className="snapshot-banner" role="status">
          <Info weight="bold" />
          Portable demo snapshot loaded from this URL. Imported AI assessments were
          discarded; verify its decisions against the source evidence.
        </div>
      )}

      <main className={`workspace ${activeTab === "timeline" ? "timeline-workspace" : ""}`}>
        {activeTab === "timeline" ? (
          <Timeline
            selectedId={selectedId}
            onSelect={setSelectedId}
            onExplain={() => setHowOpen(true)}
          />
        ) : activeTab === "summary" ? (
          <SummaryView
            verdict={verdict}
            findings={findings}
            decisions={decisions}
            onOpenTimeline={() => setActiveTab("timeline")}
          />
        ) : (
          <ListView
            type={activeTab}
            findings={findings}
            decisions={decisions}
            onSelect={openEvent}
          />
        )}

        {activeTab === "timeline" && selectedEvent && (
          <DetailPanel
            event={selectedEvent}
            issue={selectedIssue}
            assessmentEntry={assessments[selectedEvent.id]}
            analysisError={analysisErrors[selectedEvent.id]}
            isAnalyzing={isAnalyzing}
            analystAccess={analystAccess}
            onAnalyze={analyzeEvidence}
            onReview={() => setReviewOpen(true)}
            onClose={() => setSelectedId(null)}
          />
        )}
      </main>

      {reviewOpen && selectedIssue && (
        <ReviewDialog
          issue={selectedIssue}
          actor={analystAccess.actor || release.reviewer}
          onClose={() => setReviewOpen(false)}
          onSubmit={appendReviewProposal}
        />
      )}
      {accessOpen && (
        <AccessDialog
          onClose={() => setAccessOpen(false)}
          onAuthenticated={(actor) => {
            setAnalystAccess({ status: "ready", actor });
            setAccessOpen(false);
            showToast("Live AI review unlocked for this browser session");
          }}
        />
      )}
      {shareUrl && (
        <ShareDialog
          url={shareUrl}
          onClose={() => setShareUrl("")}
          onToast={showToast}
        />
      )}
      {howOpen && <HowItWorksDialog onClose={() => setHowOpen(false)} />}
      <Toast toast={toast} />
    </div>
  );
}
