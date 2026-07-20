import { CaretDown } from "@phosphor-icons/react";

export function VerdictHistory({ runs }) {
  return (
    <ol className="rt-verdict-history">
      {runs.map((run, index) => (
        <li key={run.id}>
          {index > 0 && <CaretDown className="rt-verdict-history-arrow" weight="bold" />}
          <span className={`rt-verdict-history-chip ${run.status}`}>
            <strong>{run.label}</strong>
            <small>{run.at}</small>
          </span>
        </li>
      ))}
    </ol>
  );
}
