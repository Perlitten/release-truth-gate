import { ClockCounterClockwise } from "@phosphor-icons/react";

export function AuditTrail({ events, onJump }) {
  return (
    <div className="rt-audit-list">
      {events.map((event) => {
        const body = (
          <>
            <strong>
              {event.actorName}{" "}
              {event.actionText}
            </strong>
            <small title={event.fullTimestamp}>{event.dateText} · {event.hashText}…</small>
          </>
        );
        return (
          <article key={event.id}>
            <span><ClockCounterClockwise /></span>
            {event.targetTab ? (
              <button type="button" className="rt-audit-jump" onClick={() => onJump(event.targetTab)}>
                {body}
              </button>
            ) : (
              <div>{body}</div>
            )}
          </article>
        );
      })}
    </div>
  );
}
