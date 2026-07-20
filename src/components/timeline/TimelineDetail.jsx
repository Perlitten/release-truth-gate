import { Kicker } from "../core/Kicker.jsx";
import { TIMELINE_STATUS } from "../../lib/timeline-constants.js";

export function TimelineDetail({ selected, claimOwners, capturedLabel, capturedTitle, children }) {
  return (
    <aside className={`rt-timeline-detail ${selected.status}`}>
      <div className="rt-timeline-detail-head">
        <Kicker>Selected event</Kicker>
        <span className={`rt-timeline-detail-status ${selected.status}`}>
          {(() => {
            const StatusIcon = TIMELINE_STATUS[selected.status].icon;
            return <StatusIcon weight="fill" />;
          })()}
          {selected.statusLabel || TIMELINE_STATUS[selected.status].label}
        </span>
      </div>
      <h3>{selected.title}</h3>
      <dl>
        <div><dt>Type</dt><dd>{selected.detail.kind}</dd></div>
        {selected.detail.relation && (
          <div><dt>Relation</dt><dd>{selected.detail.relation}</dd></div>
        )}
        {selected.detail.path && (
          <div><dt>Source</dt><dd>{selected.detail.path}</dd></div>
        )}
        {selected.detail.revision && (
          <div><dt>Revision</dt><dd><code>{selected.detail.revision}</code></dd></div>
        )}
        {Number.isFinite(selected.detail.confidence) && (
          <div>
            <dt>Confidence</dt>
            <dd>{Math.round(selected.detail.confidence * 100)}%</dd>
          </div>
        )}
        {selected.detail.author && (
          <div><dt>Recorded by</dt><dd>{selected.detail.author}</dd></div>
        )}
        {(selected.detail.owner || claimOwners.get(selected.claimId)?.name) && (
          <div>
            <dt>Owner</dt>
            <dd>{selected.detail.owner || claimOwners.get(selected.claimId).name}</dd>
          </div>
        )}
        <div><dt>Captured</dt><dd title={capturedTitle}>{capturedLabel}</dd></div>
      </dl>
      {selected.detail.excerpt && (
        <blockquote>{selected.detail.excerpt}</blockquote>
      )}
      {selected.detail.hash && (
        <p className="rt-timeline-hash">
          sha256 <code>{selected.detail.hash.slice(0, 16)}…</code>
        </p>
      )}
      {children}
    </aside>
  );
}
