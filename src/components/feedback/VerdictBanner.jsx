import { ArrowRight } from "@phosphor-icons/react";

export function VerdictBanner({ status, label, icon: Icon, latestRunAt, blockers, onBlockerClick }) {
  return (
    <section className={`rt-verdict-banner ${status}`} aria-label={`Server verdict: ${label}`}>
      <Icon weight="fill" aria-hidden="true" />
      <div>
        <span>Server verdict</span>
        <strong>{label}</strong>
      </div>
      <p>
        {latestRunAt
          ? `Computed ${latestRunAt} from the current evidence ledger.`
          : "No server verdict has been stored. Treat this release as blocked until one is run."}
      </p>
      {blockers.length > 0 && (
        <ul className="rt-verdict-blockers">
          {blockers.map((blocker) => (
            <li key={blocker.claimId}>
              <button type="button" onClick={() => onBlockerClick(blocker.claimId)}>
                {blocker.title}
                <span>
                  {blocker.contradictionCount}{" "}
                  {blocker.contradictionCount === 1 ? "contradiction" : "contradictions"}
                </span>
                <ArrowRight weight="bold" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
