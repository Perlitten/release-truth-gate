"use client";

import { useMemo, useState } from "react";
import {
  ArrowSquareOut,
  BracketsCurly,
  CalendarBlank,
  CaretLeft,
  CaretRight,
  Check,
  ClipboardText,
  Code,
  DownloadSimple,
  FileText,
  GitDiff,
  HourglassMedium,
  Info,
  ListChecks,
  LockKey,
  MagnifyingGlass,
  Pulse,
  Robot,
  ShareNetwork,
  ShieldCheck,
  Sparkle,
  SpinnerGap,
  UsersThree,
  Warning,
  X,
} from "@phosphor-icons/react";
import { analysisPayload, defaultFindings, lanes, release } from "./data.js";
import { applyHumanDecision, calculateVerdict } from "./lib/verdict.js";

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

const fallbackAssessment = {
  verdict: "no_go",
  headline: "Current evidence contradicts the approved privacy claim.",
  finding:
    "The telemetry schema added a full message content field after privacy approval, and the current privacy test fails on the same boundary.",
  impact:
    "Launching without a new approval would break the stated retention promise and create an avoidable privacy exposure.",
  confidence: 0.96,
  invalidatesDecision: "privacy-approval-jul-16",
  evidence: [
    {
      sourceId: "telemetry-schema-b7e6c3d",
      relation: "contradicts",
      excerpt: "message_text: Full message content",
    },
    {
      sourceId: "privacy-ci-c5e8f92",
      relation: "contradicts",
      excerpt: "telemetry payload includes message_text",
    },
  ],
  missingEvidence: ["A new privacy approval for the current telemetry schema"],
  recommendedAction:
    "Remove message_text from telemetry or obtain a new privacy approval, then rerun the boundary test.",
};

function statusLabel(status) {
  return {
    verified: "Verified",
    contradicted: "Contradicted",
    pending: "Pending",
    superseded: "Superseded",
    unproven: "Unproven",
  }[status];
}

function StatusMark({ status, compact = false }) {
  if (status === "pending") {
    return (
      <span className={`status-mark pending ${compact ? "compact" : ""}`} aria-label="Pending">
        <HourglassMedium weight="bold" />
      </span>
    );
  }

  if (status === "superseded") {
    return (
      <span className={`status-mark superseded ${compact ? "compact" : ""}`} aria-label="Superseded">
        <CaretRight weight="bold" />
      </span>
    );
  }

  if (status === "contradicted") {
    return (
      <span
        className={`status-mark contradicted ${compact ? "compact" : ""}`}
        aria-label="Contradicted"
      >
        <X weight="bold" />
      </span>
    );
  }

  return (
    <span className={`status-mark verified ${compact ? "compact" : ""}`} aria-label="Verified">
      <Check weight="bold" />
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
          <small>{verdict.status === "no_go" ? "review required" : verdict.detail}</small>
        </div>

        <div className="release-date">
          <CalendarBlank />
          <div>
            <span>Launch date</span>
            <strong>{release.date}</strong>
          </div>
        </div>

        <div className="today-date">
          <CalendarBlank />
          <span>
            Today is <strong>{release.today}</strong>
          </span>
        </div>
      </header>

      <div className="mobile-action-bar">
        <button type="button" onClick={onShare}>
          <ShareNetwork /> Share
        </button>
        <button type="button" onClick={onExport}>
          <DownloadSimple /> Export
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
              key={item.id}
            >
              <Icon />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
      <div className="nav-actions">
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

function Timeline({ selectedId, onSelect, eventStatuses }) {
  return (
    <section className="timeline" aria-label="Evidence timeline">
      <div className="timeline-head">
        <div className="month-label">
          <span>July 2026</span>
          <div className="timeline-stepper">
            <button type="button" aria-label="Previous week">
              <CaretLeft />
            </button>
            <button type="button" aria-label="Next week">
              <CaretRight />
            </button>
          </div>
        </div>
        {release.days.map((day) => (
          <div className={`day-heading ${day.today ? "today" : ""}`} key={day.id}>
            <span>{day.weekday}</span>
            <strong>{day.date}</strong>
            {day.today && <small>Today</small>}
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
            {lane.events.map((event, index) => {
              const currentStatus = eventStatuses[event.id] || event.status;
              return (
                <button
                  type="button"
                  className={[
                    "timeline-event",
                    currentStatus,
                    selectedId === event.id ? "selected" : "",
                    release.days[index].today ? "current-day" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  key={event.id}
                  onClick={() => onSelect(event.id)}
                  aria-pressed={selectedId === event.id}
                >
                  <span className="event-track" aria-hidden="true" />
                  <StatusMark status={currentStatus} />
                  <span className="event-title">
                    {event.title.split("\n").map((line) => (
                      <span key={line}>{line}</span>
                    ))}
                  </span>
                  <span className="event-revision">{event.revision}</span>
                  <span className="event-time">{event.time}</span>
                </button>
              );
            })}
          </div>
        );
      })}

      <div className="legend">
        <div>
          <StatusMark status="verified" compact />
          <span>
            <strong>Verified</strong>
            <small>Evidence supports the claim</small>
          </span>
        </div>
        <div>
          <StatusMark status="contradicted" compact />
          <span>
            <strong>Contradicted</strong>
            <small>Evidence invalidates a prior item</small>
          </span>
        </div>
        <div>
          <StatusMark status="pending" compact />
          <span>
            <strong>Pending</strong>
            <small>Awaiting verification or review</small>
          </span>
        </div>
        <div>
          <StatusMark status="superseded" compact />
          <span>
            <strong>Superseded</strong>
            <small>Replaced by a newer revision</small>
          </span>
        </div>
        <button type="button" className="how-it-works">
          How this works <Info />
        </button>
      </div>
    </section>
  );
}

function CodeExcerpt({ event, showDiff }) {
  if (!event.excerpt) return null;

  return (
    <div className="detail-section">
      <h4>Source excerpt <span>({event.source})</span></h4>
      <div className={`code-excerpt ${showDiff ? "show-diff" : ""}`}>
        {showDiff && <div className="removed-line">− event_name only</div>}
        {event.excerpt.map((line, index) => (
          <div
            className={showDiff && index >= 1 && index <= 4 ? "added-line" : ""}
            key={`${line}-${index}`}
          >
            <span>{142 + index}</span>
            <code>{line}</code>
          </div>
        ))}
      </div>
    </div>
  );
}

function DetailPanel({
  event,
  status,
  aiAssessment,
  isAnalyzing,
  onAnalyze,
  onResolve,
  onClose,
}) {
  const [showDiff, setShowDiff] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);

  return (
    <aside className={`detail-panel status-${status}`} aria-label="Selected event details">
      <div className="detail-topline">
        <div>
          <StatusMark status={status} compact />
          <span>Selected event</span>
        </div>
        <span>Today, Jul 18, 2026&nbsp;&nbsp; {event.time}</span>
        <button type="button" className="panel-close" onClick={onClose} aria-label="Close details">
          <X />
        </button>
      </div>

      <h2>{event.headline || event.title.replace("\n", " ")}</h2>
      <p className="detail-summary">{event.summary}</p>

      <dl className="detail-meta">
        <div>
          <dt>Lane</dt>
          <dd>{event.laneLabel}</dd>
        </div>
        <div>
          <dt>Event type</dt>
          <dd>{statusLabel(status)}</dd>
        </div>
        <div>
          <dt>Source</dt>
          <dd>{event.source}</dd>
        </div>
        <div>
          <dt>Revision</dt>
          <dd>{event.revision.replace("rev ", "")}</dd>
        </div>
        <div>
          <dt>Owner</dt>
          <dd>{event.owner}</dd>
        </div>
        <div>
          <dt>Confidence</dt>
          <dd className="confidence">
            <span>{Math.round((event.confidence || 0.92) * 100)}%</span>
            <span className="confidence-dots" aria-hidden="true">
              {[1, 2, 3, 4, 5].map((dot) => (
                <i key={dot} className={dot <= Math.round((event.confidence || 0.92) * 5) ? "on" : ""} />
              ))}
            </span>
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

      {aiAssessment && (
        <div className="ai-assessment">
          <span className="ai-label">
            <Robot weight="bold" /> Evidence analyst
          </span>
          <strong>{aiAssessment.headline}</strong>
          <p>{aiAssessment.recommendedAction}</p>
          <small>{Math.round(aiAssessment.confidence * 100)}% confidence · evidence cited</small>
        </div>
      )}

      {reviewOpen && (
        <div className="review-menu" role="dialog" aria-label="Review change">
          <div>
            <strong>Resolve this conflict</strong>
            <button type="button" onClick={() => setReviewOpen(false)} aria-label="Close review menu">
              <X />
            </button>
          </div>
          <p>Human decisions stay explicit and are recorded in the release history.</p>
          <button type="button" onClick={() => onResolve("superseded")}>
            Mark prior claim superseded
          </button>
          <button type="button" onClick={() => onResolve("accept_risk")}>
            Accept risk for launch review
          </button>
        </div>
      )}

      <div className="detail-actions">
        <button type="button" className="primary" onClick={() => setReviewOpen(true)}>
          <ShieldCheck /> Review change
        </button>
        <button type="button" onClick={() => setShowDiff((current) => !current)}>
          <GitDiff /> {showDiff ? "Hide comparison" : "Compare revisions"}
        </button>
      </div>
      <button type="button" className="ai-action" onClick={onAnalyze} disabled={isAnalyzing}>
        {isAnalyzing ? <SpinnerGap className="spin" /> : <Sparkle weight="fill" />}
        {isAnalyzing ? "Analyzing evidence…" : "Run AI evidence review"}
      </button>
    </aside>
  );
}

function SummaryView({ verdict, findings, onOpenTimeline }) {
  const contradicted = findings.filter((item) => item.status === "contradicted").length;
  const pending = findings.filter((item) => item.status === "pending").length;
  const cards = [
    { label: "Blocking conflicts", value: contradicted, icon: X, tone: "red" },
    { label: "Pending reviews", value: pending, icon: HourglassMedium, tone: "amber" },
    { label: "Evidence sources", value: 18, icon: BracketsCurly, tone: "teal" },
    { label: "Days to launch", value: 3, icon: CalendarBlank, tone: "navy" },
  ];

  return (
    <section className="section-view">
      <div className="section-heading">
        <div>
          <span className="section-kicker">Release state</span>
          <h2>Launch confidence at a glance</h2>
          <p>Every decision is traced to the evidence that currently supports or contradicts it.</p>
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
          <span>Current verdict</span>
          <h3>{verdict.label}</h3>
          <p>{verdict.detail}. The final decision remains with the release owner.</p>
        </div>
        <LockKey weight="duotone" />
      </article>
    </section>
  );
}

function ListView({ type, onSelect }) {
  const allEvents = lanes.flatMap((lane) =>
    lane.events.map((event) => ({ ...event, laneLabel: lane.label })),
  );
  const filters = {
    evidence: allEvents.filter((event) => event.status !== "verified" || event.source !== "repository"),
    risks: allEvents.filter((event) => event.riskType),
    decisions: allEvents.filter((event) => event.laneLabel === "Decisions"),
  };
  const copy = {
    evidence: {
      kicker: "Source registry",
      title: "Evidence with revision history",
      description: "Open any source to inspect why it changed the release state.",
    },
    risks: {
      kicker: "Open review queue",
      title: "Risks that can change the verdict",
      description: "High-confidence privacy conflicts block launch automatically.",
    },
    decisions: {
      kicker: "Human accountability",
      title: "Decision history",
      description: "Approvals remain attached to the exact evidence revision they reviewed.",
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
          <input aria-label={`Search ${type}`} placeholder={`Search ${type}`} />
        </label>
      </div>
      <div className="evidence-list">
        {filters[type].map((event) => (
          <button type="button" onClick={() => onSelect(event.id)} key={event.id}>
            <StatusMark status={event.status} compact />
            <span className="list-copy">
              <strong>{event.title.replace("\n", " ")}</strong>
              <small>{event.source} · {event.revision}</small>
            </span>
            <span className={`status-pill ${event.status}`}>{statusLabel(event.status)}</span>
            <CaretRight />
          </button>
        ))}
      </div>
    </section>
  );
}

function Toast({ message }) {
  if (!message) return null;
  return (
    <div className="toast" role="status">
      <Check weight="bold" />
      {message}
    </div>
  );
}

export function App() {
  const [activeTab, setActiveTab] = useState("timeline");
  const [selectedId, setSelectedId] = useState("privacy-conflict");
  const [findings, setFindings] = useState(defaultFindings);
  const [assessment, setAssessment] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [toast, setToast] = useState("");

  const verdict = useMemo(() => calculateVerdict(findings), [findings]);
  const selectedEvent = useMemo(() => {
    for (const lane of lanes) {
      const event = lane.events.find((item) => item.id === selectedId);
      if (event) return { ...event, laneLabel: lane.label };
    }
    return null;
  }, [selectedId]);
  const eventStatuses = useMemo(
    () => Object.fromEntries(findings.map((finding) => [finding.id, finding.status])),
    [findings],
  );
  const selectedStatus = eventStatuses[selectedId] || selectedEvent?.status;

  function showToast(message) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2800);
  }

  function openEvent(eventId) {
    setSelectedId(eventId);
    setActiveTab("timeline");
  }

  function resolveEvent(decision) {
    setFindings((current) => applyHumanDecision(current, selectedId, decision));
    showToast(decision === "superseded" ? "Decision recorded as superseded" : "Risk acceptance queued for signoff");
  }

  async function analyzeEvidence() {
    setIsAnalyzing(true);
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(analysisPayload),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Review failed.");
      setAssessment(payload.assessment);
      showToast("AI review completed with cited evidence");
    } catch {
      setAssessment(fallbackAssessment);
      showToast("Demo assessment loaded; live analyst was unavailable");
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function shareRelease() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      showToast("Release link copied");
    } catch {
      showToast("Release link is ready to share");
    }
  }

  function exportRelease() {
    const content = JSON.stringify(
      {
        release,
        verdict,
        findings,
        exportedAt: new Date().toISOString(),
      },
      null,
      2,
    );
    const url = URL.createObjectURL(new Blob([content], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "nova-2.4-release-evidence.json";
    link.click();
    URL.revokeObjectURL(url);
    showToast("Release evidence exported");
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

      <main className={`workspace ${activeTab === "timeline" ? "timeline-workspace" : ""}`}>
        {activeTab === "timeline" ? (
          <Timeline
            selectedId={selectedId}
            onSelect={setSelectedId}
            eventStatuses={eventStatuses}
          />
        ) : activeTab === "summary" ? (
          <SummaryView
            verdict={verdict}
            findings={findings}
            onOpenTimeline={() => setActiveTab("timeline")}
          />
        ) : (
          <ListView type={activeTab} onSelect={openEvent} />
        )}

        {activeTab === "timeline" && selectedEvent && (
          <DetailPanel
            event={selectedEvent}
            status={selectedStatus}
            aiAssessment={assessment}
            isAnalyzing={isAnalyzing}
            onAnalyze={analyzeEvidence}
            onResolve={resolveEvent}
            onClose={() => setSelectedId(null)}
          />
        )}
      </main>
      <Toast message={toast} />
    </div>
  );
}
