import { SpinnerGap, Sparkle, WarningCircle } from "@phosphor-icons/react";
import { Button } from "../core/Button.jsx";

export function AIAssessment({ assessing, assessError, assessment, onAssess }) {
  return (
    <div className="rt-ai-panel">
      <Button
        type="button"
        variant="secondary"
        className="rt-ai-trigger"
        onClick={onAssess}
        disabled={assessing}
      >
        {assessing ? <SpinnerGap className="rt-spin" /> : <Sparkle weight="fill" />}
        {assessing ? "Asking GPT-5.6…" : "Assess with GPT-5.6"}
      </Button>
      {assessError && (
        <p className="rt-error" role="alert"><WarningCircle /> {assessError}</p>
      )}
      {assessment && (
        <article className={`rt-ai-result ${assessment.assessment.relation}`}>
          <div className="rt-ai-result-head">
            <span className="rt-ai-mode">
              {assessment.mode === "live" ? "LIVE" : assessment.mode} · {assessment.model}
            </span>
            <span>{Math.round(assessment.assessment.confidence * 100)}% confidence</span>
          </div>
          <h4>{assessment.assessment.headline}</h4>
          <p>{assessment.assessment.finding}</p>
          <p className="rt-ai-impact"><strong>Impact —</strong> {assessment.assessment.impact}</p>
          <ul className="rt-ai-citations">
            {assessment.assessment.evidence.map((citation) => (
              <li key={citation.sourceId}>
                <span>{citation.relation}</span>
                <q>{citation.excerpt}</q>
              </li>
            ))}
          </ul>
          {assessment.assessment.missingEvidence.length > 0 && (
            <p className="rt-ai-missing">
              Missing: {assessment.assessment.missingEvidence.join("; ")}
            </p>
          )}
          <p className="rt-ai-action"><strong>Recommended —</strong> {assessment.assessment.recommendedAction}</p>
        </article>
      )}
    </div>
  );
}
