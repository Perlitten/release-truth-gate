import { TIMELINE_LANES, TIMELINE_STATUS } from "../../lib/timeline-constants.js";

export function TimelineBoard({ boardRef, days, events, selectedId, onSelect }) {
  return (
    <div
      className="rt-timeline-board"
      role="grid"
      aria-label="Release timeline"
      ref={boardRef}
    >
      <div className="rt-timeline-grid" style={{ "--rt-days": days.length }}>
        <span className="rt-timeline-corner" />
        {days.map((day) => (
          <span className="rt-timeline-day" key={day.key} title={day.title}>
            {day.label}
          </span>
        ))}
        {TIMELINE_LANES.map((lane) => (
          <div className="rt-timeline-row" key={lane.id} role="row">
            <div className="rt-timeline-lane">
              <span><lane.icon weight="duotone" /></span>
              <div>
                <strong>{lane.label}</strong>
                <small>{lane.hint}</small>
              </div>
            </div>
            {days.map((day) => (
              <div className="rt-timeline-cell" key={day.key}>
                {events
                  .filter(
                    (event) =>
                      event.lane === lane.id && event.dayKey === day.key,
                  )
                  .map((event) => {
                    const status = TIMELINE_STATUS[event.status];
                    return (
                      <button
                        type="button"
                        className={`rt-timeline-event ${event.status} ${
                          selectedId === event.id ? "selected" : ""
                        }`}
                        onClick={() => onSelect(event.id)}
                        key={event.id}
                        data-event-id={event.id}
                      >
                        <status.icon weight="fill" />
                        <span>{event.title}</span>
                        <small title={event.timeTitle}>{event.time}</small>
                      </button>
                    );
                  })}
              </div>
            ))}
          </div>
        ))}
      </div>
      <footer className="rt-timeline-legend">
        {Object.entries(TIMELINE_STATUS).map(([id, status]) => (
          <span className={id} key={id}>
            <status.icon weight="fill" /> {status.label}
          </span>
        ))}
      </footer>
    </div>
  );
}
