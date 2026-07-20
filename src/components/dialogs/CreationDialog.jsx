"use client";

import { useEffect, useState } from "react";
import { ArrowRight } from "@phosphor-icons/react";
import { Dialog } from "../feedback/Dialog.jsx";
import { Form } from "../forms/Form.jsx";
import { Field } from "../forms/Field.jsx";
import { FieldRow } from "../forms/FieldRow.jsx";
import { Check } from "../forms/Check.jsx";
import { CheckboxList } from "../forms/CheckboxList.jsx";
import { ErrorMessage } from "../forms/ErrorMessage.jsx";
import { Button } from "../core/Button.jsx";
import { api } from "../../lib/api.js";

export function CreationDialog({ type, context, onClose, onCreated }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [decisionClaimId, setDecisionClaimId] = useState(
    context?.claims?.[0]?.id || "",
  );
  const [decisionType, setDecisionType] = useState("approval");
  const [targetType, setTargetType] = useState("tag");
  const [members, setMembers] = useState([]);
  useEffect(() => {
    if (type !== "decision" || !context?.workspace?.id) return;
    let cancelled = false;
    api(`/api/workspaces/${context.workspace.id}/members`)
      .then((result) => {
        if (!cancelled) setMembers(result.members);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [type, context?.workspace?.id]);
  const decisionEvidence = context?.evidence?.filter((item) =>
    context.links?.some(
      (link) => link.claimId === decisionClaimId && link.evidenceId === item.id,
    ),
  ) || [];
  const config = {
    workspace: { title: "New workspace", eyebrow: "Organization boundary" },
    project: { title: "New project", eyebrow: context?.workspace?.name },
    release: { title: "New release", eyebrow: context?.project?.name },
    claim: { title: "Add a claim", eyebrow: context?.release?.name },
    evidence: { title: "Add evidence", eyebrow: context?.release?.name },
    decision: { title: "Record decision", eyebrow: context?.release?.name },
  }[type];

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const data = new FormData(event.currentTarget);
    let payload;
    if (type === "workspace") payload = { name: data.get("name") };
    if (type === "project") {
      payload = { name: data.get("name"), description: data.get("description") };
    }
    if (type === "release") {
      payload = {
        name: data.get("name"),
        description: data.get("description"),
        targetType,
        targetValue: targetType === "unspecified" ? null : data.get("targetValue"),
      };
    }
    if (type === "claim") {
      payload = {
        title: data.get("title"),
        description: data.get("description"),
        acceptanceCriteria: data.get("acceptanceCriteria"),
        material: data.get("material") === "on",
        requiredEvidenceKinds: data
          .get("requiredEvidenceKinds")
          .split(",")
          .map((value) => value.trim().toLowerCase())
          .filter(Boolean),
        sourceReference: data.get("sourceReference") || null,
      };
    }
    if (type === "evidence") {
      payload = {
        summary: data.get("summary"),
        relation: data.get("relation"),
        evidenceKind: data.get("evidenceKind"),
        sourceUrl: data.get("sourceUrl") || null,
        sourceReference: data.get("sourceReference") || null,
        authorName: data.get("authorName") || null,
        claimIds: data.getAll("claimIds"),
      };
    }
    if (type === "decision") {
      payload = {
        claimId: data.get("claimId"),
        type: data.get("decisionType"),
        rationale: data.get("rationale"),
        assigneeId:
          data.get("decisionType") === "assignment" ? data.get("assigneeId") : null,
        reviewedEvidence: data.get("reviewedEvidence") === "on",
        basedOnEvidenceIds: data.getAll("basedOnEvidenceIds"),
      };
    }
    setBusy(true);
    setError("");
    try {
      await onCreated(type, payload);
      onClose();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog title={config.title} eyebrow={config.eyebrow} onClose={onClose}>
      <Form onSubmit={submit}>
        {type === "workspace" && (
          <Field label="Workspace name">
            <input name="name" minLength={2} maxLength={120} required autoFocus />
          </Field>
        )}
        {type === "project" && (
          <>
            <Field label="Project name">
              <input name="name" minLength={2} maxLength={160} required autoFocus />
            </Field>
            <Field label="Description">
              <textarea name="description" rows={4} maxLength={4_000} />
            </Field>
          </>
        )}
        {type === "release" && (
          <>
            <Field label="Release name" hint="Version, milestone, or launch name">
              <input name="name" maxLength={160} required autoFocus />
            </Field>
            <Field label="Description">
              <textarea name="description" rows={3} maxLength={4_000} />
            </Field>
            <FieldRow>
              <Field label="Target type">
                <select name="targetType" value={targetType} onChange={(event) => setTargetType(event.target.value)}>
                  <option value="tag">Git tag</option>
                  <option value="branch">Branch</option>
                  <option value="commit">Commit</option>
                  <option value="unspecified">Not set yet</option>
                </select>
              </Field>
              <Field label="Target value" hint={targetType === "unspecified" ? "Not needed when the target is unspecified." : "Required for the selected target type."}>
                <input name="targetValue" placeholder="v1.0.0" maxLength={255} required={targetType !== "unspecified"} disabled={targetType === "unspecified"} />
              </Field>
            </FieldRow>
          </>
        )}
        {type === "claim" && (
          <>
            <Field label="Claim">
              <input name="title" minLength={2} maxLength={240} required autoFocus />
            </Field>
            <Field label="What must be true?">
              <textarea name="description" rows={3} minLength={2} required />
            </Field>
            <Field label="Acceptance criteria">
              <textarea name="acceptanceCriteria" rows={3} minLength={2} required />
            </Field>
            <Field
              label="Required evidence kinds"
              hint="Comma-separated. Example: code, test, check"
            >
              <input name="requiredEvidenceKinds" defaultValue="code, test" required />
            </Field>
            <Field label="Source reference" hint="Optional document or ticket reference">
              <input name="sourceReference" maxLength={500} />
            </Field>
            <Check label="Material to the release verdict" name="material" defaultChecked />
          </>
        )}
        {type === "evidence" && (
          <>
            <Field label="Evidence summary">
              <textarea name="summary" rows={4} minLength={2} required autoFocus />
            </Field>
            <FieldRow>
              <Field label="Relation">
                <select name="relation" defaultValue="supports">
                  <option value="supports">Supports</option>
                  <option value="contradicts">Contradicts</option>
                  <option value="missing">Missing / incomplete</option>
                </select>
              </Field>
              <Field label="Evidence kind">
                <input name="evidenceKind" defaultValue="test" required />
              </Field>
            </FieldRow>
            <Field label="Link to one or more claims">
              <CheckboxList>
                {context.claims.map((claim) => (
                  <label key={claim.id}>
                    <input
                      type="checkbox"
                      name="claimIds"
                      value={claim.id}
                      defaultChecked={context.claims.length === 1}
                    />
                    <span>{claim.title}</span>
                  </label>
                ))}
              </CheckboxList>
            </Field>
            <Field label="Source URL" hint="Optional. Must be a complete http:// or https:// URL.">
              <input name="sourceUrl" type="url" maxLength={2_000} />
            </Field>
            <Field label="Source reference" hint="Commit, file, test run, or document">
              <input name="sourceReference" maxLength={500} />
            </Field>
            <Field label="Author / observer">
              <input name="authorName" maxLength={160} />
            </Field>
          </>
        )}
        {type === "decision" && (
          <>
            <Field label="Claim">
              <select
                name="claimId"
                value={decisionClaimId}
                onChange={(event) => setDecisionClaimId(event.target.value)}
                required
              >
                {context.claims.map((claim) => (
                  <option value={claim.id} key={claim.id}>{claim.title}</option>
                ))}
              </select>
            </Field>
            <Field label="Decision">
              <select
                name="decisionType"
                value={decisionType}
                onChange={(event) => setDecisionType(event.target.value)}
              >
                <option value="approval">Approve current evidence head</option>
                <option value="rejection">Reject</option>
                <option value="risk_acceptance">Accept documented risk</option>
                <option value="comment">Reviewer comment</option>
                <option value="assignment">Assign to a teammate for resolution</option>
              </select>
            </Field>
            <Field
              label="Rationale"
              hint={
                decisionType === "assignment"
                  ? "At least 12 characters. Explain what needs to be resolved."
                  : "At least 12 characters. Explain why the evidence is sufficient or insufficient."
              }
            >
              <textarea name="rationale" rows={4} minLength={12} required />
            </Field>
            {decisionType === "assignment" && (
              <Field label="Assignee">
                <select name="assigneeId" required defaultValue="">
                  <option value="" disabled>Choose a workspace member</option>
                  {members.map((member) => (
                    <option value={member.userId} key={member.userId}>
                      {member.displayName} ({member.role})
                    </option>
                  ))}
                </select>
              </Field>
            )}
            {decisionType !== "assignment" && (
              <Field label="Evidence considered">
                <CheckboxList detailed>
                  {decisionEvidence.map((item) => (
                    <label key={item.id}>
                      <input
                        type="checkbox"
                        name="basedOnEvidenceIds"
                        value={item.id}
                        defaultChecked
                      />
                      <span>
                        <strong>{item.summary}</strong>
                        {item.payloadSnapshot?.content && (
                          <q>{item.payloadSnapshot.content}</q>
                        )}
                      </span>
                    </label>
                    ))}
                </CheckboxList>
                {decisionEvidence.length === 0 && (
                  <small className="rt-field-hint">No evidence is linked to this claim yet. Record the decision only after reviewing the available evidence.</small>
                )}
              </Field>
            )}
            {decisionType !== "assignment" && decisionEvidence.length > 0 && (
              <Check label="I have read the evidence content above, not only the titles, before recording this decision." className="rt-review-ack" name="reviewedEvidence" required  />
            )}
          </>
      )}
        {error && <ErrorMessage>{error}</ErrorMessage>}
        <div className="rt-dialog-actions">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button busy={busy} type="submit">Create record <ArrowRight /></Button>
        </div>
      </Form>
    </Dialog>
  );
}
