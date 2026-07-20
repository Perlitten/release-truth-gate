"use client";

import {
  ArrowClockwise,
  ArrowRight,
  BracketsCurly,
  CaretDown,
  CheckCircle,
  ClipboardText,
  ClockCounterClockwise,
  Database,
  DownloadSimple,
  Flask,
  Folder,
  GithubLogo,
  LockKey,
  Plus,
  RocketLaunch,
  Scales,
  ShieldCheck,
  SignOut,
  Sparkle,
  SpinnerGap,
  UserPlus,
  UsersThree,
  WarningCircle,
  X,
  XCircle,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Avatar } from "./components/core/Avatar.jsx";
import { Badge } from "./components/core/Badge.jsx";
import { Button } from "./components/core/Button.jsx";
import { DemoBadge } from "./components/core/DemoBadge.jsx";
import { Kicker } from "./components/core/Kicker.jsx";
import { Logo } from "./components/core/Logo.jsx";
import { StateChip } from "./components/core/StateChip.jsx";
import { Check } from "./components/forms/Check.jsx";
import { CheckboxList } from "./components/forms/CheckboxList.jsx";
import { ErrorMessage } from "./components/forms/ErrorMessage.jsx";
import { Field } from "./components/forms/Field.jsx";
import { FieldRow } from "./components/forms/FieldRow.jsx";
import { Form } from "./components/forms/Form.jsx";
import { Notice } from "./components/forms/Notice.jsx";
import { Dialog } from "./components/feedback/Dialog.jsx";
import { EmptyState } from "./components/feedback/EmptyState.jsx";
import { RecordSection } from "./components/records/RecordSection.jsx";
import { VerdictBanner } from "./components/feedback/VerdictBanner.jsx";
import { MetricCard } from "./components/feedback/MetricCard.jsx";
import { VerdictHistory } from "./components/feedback/VerdictHistory.jsx";
import { RecordCard } from "./components/records/RecordCard.jsx";
import { TIMELINE_LANES, TIMELINE_STATUS, LANE_TO_FOCUS } from "./lib/timeline-constants.js";

import { isAllowedSourceUrl } from "./lib/source-url.js";

const markers = {
  login: "auth-login",
  register: "auth-register",
  logout: "auth-logout",
  workspace: "workspace-create",
  project: "project-create",
  release: "release-create",
  claim: "claim-create",
  evidence: "evidence-create",
  decision: "decision-create",
  verdict: "verdict-run",
  export: "export-generate",
  invite: "workspace-invitation",
  invitationAccept: "invitation-accept",
  demo: "demo-session",
  releaseUpdate: "release-update",
  githubConnect: "github-connect",
  githubLink: "github-repository-link",
  githubImport: "github-import",
};

const capabilities = {
  owner: new Set(["create_project", "manage_release", "create_claim", "create_evidence", "create_decision", "run_verdict", "generate_export", "manage_members", "manage_integrations"]),
  admin: new Set(["create_project", "manage_release", "create_claim", "create_evidence", "create_decision", "run_verdict", "generate_export", "manage_members", "manage_integrations"]),
  contributor: new Set(["create_project", "manage_release", "create_claim", "create_evidence", "run_verdict", "generate_export"]),
  reviewer: new Set(["create_decision", "run_verdict", "generate_export"]),
  viewer: new Set(["generate_export"]),
};

function can(role, capability) {
  return capabilities[role]?.has(capability) || false;
}

async function api(path, options = {}) {
  const headers = new Headers(options.headers);
  if (options.body !== undefined) headers.set("content-type", "application/json");
  if (options.marker) headers.set("x-release-truth-request", options.marker);
  let response;
  try {
    response = await fetch(path, {
      method: options.method || "GET",
      credentials: "same-origin",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      cache: "no-store",
      signal: options.signal || AbortSignal.timeout(options.timeoutMs || 20_000),
    });
  } catch {
    const error = new Error("The server did not respond. Retry in a moment.");
    error.code = "network_unreachable";
    throw error;
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || "The request could not be completed.");
    error.code = payload.code;
    error.status = response.status;
    throw error;
  }
  return payload;
}

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

const EVIDENCE_RELATION_PRIORITY = { contradicts: 0, missing: 1, supports: 2 };
function byBlockingPriority(left, right) {
  const rank =
    (EVIDENCE_RELATION_PRIORITY[left.relation] ?? 3) -
    (EVIDENCE_RELATION_PRIORITY[right.relation] ?? 3);
  return rank !== 0 ? rank : Date.parse(right.capturedAt) - Date.parse(left.capturedAt);
}

const AUDIT_ACTION_PHRASES = {
  "claim.created": "recorded a claim",
  "evidence.created": "attached evidence",
  "export.generated": "generated a signed export",
  "verdict.run": "ran the server verdict",
  "decision.snapshot": "recorded a decision",
  "decision.correction": "corrected a decision",
  "decision.revocation": "revoked a decision",
  "project.created": "created the project",
  "project.updated": "updated the project",
  "release.created": "created the release",
  "release.updated": "updated the release",
  "workspace.created": "created the workspace",
  "membership.role_changed": "changed a member's role",
  "invitation.created": "sent a workspace invitation",
  "invitation.accepted": "accepted a workspace invitation",
  "github.installation_connected": "connected a GitHub App installation",
  "github.installation_disconnected": "disconnected a GitHub App installation",
  "github.repository_linked": "linked a GitHub repository",
  "github.object_imported": "imported a GitHub record",
  "github.object_reimported": "re-imported a GitHub record",
};

const AUDIT_TARGET_TAB = {
  claim: "claims",
  evidence: "evidence",
  decision: "decisions",
  verdict_run: "timeline",
  export_artifact: "audit",
  release: "overview",
};

function humanizeAuditAction(action) {
  if (AUDIT_ACTION_PHRASES[action]) return AUDIT_ACTION_PHRASES[action];
  if (action.startsWith("release.")) {
    return `moved the release to ${action.slice("release.".length).replace("_", " ")}`;
  }
  const [scope, verb] = action.split(".");
  return `${verb?.replace(/_/g, " ") || "updated"} the ${scope || "record"}`;
}

function initials(name) {
  return (
    name
      ?.split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "RT"
  );
}

function AuthScreen({ invitation, bootError, onAuthenticated }) {
  const [mode, setMode] = useState("register");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(bootError || "");

  async function submit(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      const payload =
        mode === "register"
          ? {
              email: data.get("email"),
              displayName: data.get("displayName"),
              password: data.get("password"),
            }
          : {
              email: data.get("email"),
              password: data.get("password"),
            };
      const result = await api(`/api/auth/${mode}`, {
        method: "POST",
        marker: markers[mode],
        body: payload,
      });
      onAuthenticated(result.user);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function enterDemo() {
    setBusy(true);
    setError("");
    try {
      const result = await api("/api/demo/session", {
        method: "POST",
        marker: markers.demo,
      });
      onAuthenticated(result.user);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="rt-auth">
      <section className="rt-auth-story">
        <Logo large />
        <Kicker>Release Truth</Kicker>
        <h1>Decide what ships.<br />Show the evidence.</h1>
        <p>
          A shared release gate for claims, immutable evidence, human decisions,
          and reproducible server verdicts.
        </p>
        <div className="rt-auth-proof">
          <span><Database /> PostgreSQL source of truth</span>
          <span><UsersThree /> Workspace roles</span>
          <span><LockKey /> Append-only records</span>
        </div>
        <ol className="rt-auth-steps">
          <li><ClipboardText weight="duotone" /> <span>Record a claim your release must satisfy</span></li>
          <li><BracketsCurly weight="duotone" /> <span>Attach current code, test, or policy evidence</span></li>
          <li><ShieldCheck weight="duotone" /> <span>Get a reproducible GO / NO-GO from the server</span></li>
        </ol>
      </section>
      <section className="rt-auth-card">
        <div className="rt-auth-tabs">
          <button
            type="button"
            className={mode === "register" ? "active" : ""}
            onClick={() => setMode("register")}
          >
            Create account
          </button>
          <button
            type="button"
            className={mode === "login" ? "active" : ""}
            onClick={() => setMode("login")}
          >
            Sign in
          </button>
        </div>
        {invitation && (
          <Notice>
            <UserPlus /> Sign in with the invited email to join the workspace.
          </Notice>
        )}
        <Form onSubmit={submit}>
          {mode === "register" && (
            <Field label="Your name">
              <input name="displayName" minLength={2} maxLength={120} required autoFocus />
            </Field>
          )}
          <Field label="Work email">
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              autoFocus={mode === "login"}
            />
          </Field>
          <Field
            label="Password"
            hint={mode === "register" ? "At least 12 characters." : undefined}
          >
            <input
              name="password"
              type="password"
              minLength={mode === "register" ? 12 : 1}
              required
              autoComplete={mode === "register" ? "new-password" : "current-password"}
            />
          </Field>
          {error && <ErrorMessage>{error}</ErrorMessage>}
        <Button busy={busy} type="submit">
          {mode === "register" ? "Create account" : "Sign in"} <ArrowRight />
        </Button>
      </Form>
      <Button
        variant="secondary"
        type="button"
        className="rt-demo-entry"
        disabled={busy}
        onClick={enterDemo}
      >
        <Sparkle weight="fill" /> Explore the Nova 2.4 demo
      </Button>
      <p className="rt-auth-foot">
        Product data stays on the server. Clearing your browser does not erase it.
      </p>
      </section>
    </main>
  );
}

function EmptyWorkspace({ user, onCreate }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      await onCreate({ name: data.get("name") });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="rt-onboarding">
      <section>
        <Logo />
        <Kicker>Welcome, {user.displayName}</Kicker>
        <h1>Create your first workspace</h1>
        <p>
          Workspaces keep projects, release evidence, teammates, and audit history
          under one authorization boundary.
        </p>
        <Form className="rt-onboarding-form" onSubmit={submit}>
          <Field label="Workspace name" hint="For example: Platform team">
            <input name="name" minLength={2} maxLength={120} required autoFocus />
          </Field>
          {error && <ErrorMessage>{error}</ErrorMessage>}
          <Button type="submit" busy={busy}>Create workspace <ArrowRight /></Button>
        </Form>
      </section>
    </main>
  );
}

function CreationDialog({ type, context, onClose, onCreated }) {
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

function TeamDialog({ workspace, onClose }) {
  const [members, setMembers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");
  const [copyStatus, setCopyStatus] = useState("");

  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const [memberResult, invitationResult] = await Promise.all([
        api(`/api/workspaces/${workspace.id}/members`),
        api(`/api/workspaces/${workspace.id}/invitations`),
      ]);
      setMembers(memberResult.members);
      setInvitations(invitationResult.invitations);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }, [workspace.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function invite(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      const result = await api(`/api/workspaces/${workspace.id}/invitations`, {
        method: "POST",
        marker: markers.invite,
        body: { email: data.get("email"), role: data.get("role") },
      });
      setInviteUrl(result.inviteUrl);
      event.currentTarget.reset();
      await load();
    } catch (requestError) {
      setError(requestError.message);
      setBusy(false);
    }
  }

  return (
    <Dialog title="Workspace team" eyebrow={workspace.name} onClose={onClose} wide>
      <div className="rt-team-grid">
        <section>
          <h3>Members</h3>
          {busy && members.length === 0 ? (
            <p className="rt-muted"><SpinnerGap className="rt-spin" /> Loading team…</p>
          ) : (
            <div className="rt-member-list">
              {members.map((member) => (
                <div key={member.userId}>
                  <Avatar initials={initials(member.displayName)} />
                  <span><strong>{member.displayName}</strong><small>{member.email}</small></span>
                  <b>{member.role}</b>
                </div>
              ))}
            </div>
          )}
        </section>
        <section>
          <h3>Invite teammate</h3>
          <Form compact onSubmit={invite}>
            <Field label="Email"><input type="email" name="email" required /></Field>
            <Field label="Role">
              <select name="role" defaultValue="reviewer">
                <option value="admin">Admin</option>
                <option value="contributor">Contributor</option>
                <option value="reviewer">Reviewer</option>
                <option value="viewer">Viewer</option>
              </select>
            </Field>
            <Button busy={busy} type="submit">Create invite <UserPlus /></Button>
          </Form>
          {inviteUrl && (
            <div className="rt-invite-link">
              <span>Single-use invite link</span>
              <input value={inviteUrl} readOnly onFocus={(event) => event.target.select()} />
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(inviteUrl);
                    setCopyStatus("Invite link copied.");
                  } catch {
                    setCopyStatus("Could not copy the link. Select and copy it manually.");
                  }
                }}
              >
                {copyStatus || "Copy link"}
              </button>
            </div>
          )}
          {invitations.length > 0 && (
            <p className="rt-muted">
              {invitations.filter((item) => !item.acceptedAt).length} pending invitation(s)
            </p>
          )}
        </section>
      </div>
      {error && <ErrorMessage>{error}</ErrorMessage>}
    </Dialog>
  );
}

function GitHubDialog({ workspace, project, snapshot, onClose, onImported }) {
  const [installations, setInstallations] = useState([]);
  const [repositories, setRepositories] = useState([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const [installationResult, repositoryResult] = await Promise.all([
        api(`/api/workspaces/${workspace.id}/github/installations?repositories=true`),
        project
          ? api(`/api/projects/${project.id}/repositories`)
          : Promise.resolve({ repositories: [] }),
      ]);
      setInstallations(installationResult.installations);
      setRepositories(repositoryResult.repositories);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }, [project, workspace.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function connect() {
    setBusy(true);
    setError("");
    try {
      const result = await api(`/api/workspaces/${workspace.id}/github/connect`, {
        method: "POST",
        marker: markers.githubConnect,
        body: {},
      });
      window.location.assign(result.installUrl);
    } catch (requestError) {
      setError(requestError.message);
      setBusy(false);
    }
  }

  async function link(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const selected = JSON.parse(data.get("repository"));
    setBusy(true);
    setError("");
    try {
      await api(`/api/projects/${project.id}/repositories`, {
        method: "POST",
        marker: markers.githubLink,
        body: selected,
      });
      await load();
    } catch (requestError) {
      setError(requestError.message);
      setBusy(false);
    }
  }

  async function importObject(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      const objectType = data.get("objectType");
      await api(`/api/releases/${snapshot.release.id}/github/import`, {
        method: "POST",
        marker: markers.githubImport,
        body: {
          projectRepositoryId: data.get("projectRepositoryId"),
          objectType,
          reference: data.get("reference"),
          claimIds:
            objectType === "issue" || !data.get("claimId")
              ? []
              : [data.get("claimId")],
          relation: data.get("relation"),
          evidenceKind: data.get("evidenceKind"),
          material: true,
        },
      });
      await onImported();
      onClose();
    } catch (requestError) {
      setError(requestError.message);
      setBusy(false);
    }
  }

  const available = installations.flatMap((installation) =>
    (installation.repositories || []).map((repository) => ({
      label: repository.fullName,
      value: JSON.stringify({
        githubInstallationId: installation.id,
        owner: repository.owner,
        repository: repository.name,
      }),
    })),
  );

  return (
    <Dialog title="GitHub evidence source" eyebrow={workspace.name} onClose={onClose} wide>
      <div className="rt-team-grid">
        <section>
          <h3>GitHub App installation</h3>
          <p className="rt-muted">
            Installation access is verified by GitHub before a repository can be linked.
          </p>
          <Button type="button" variant="secondary" onClick={connect} disabled={busy}>
            <GithubLogo /> Connect GitHub App
          </Button>
          {project && available.length > 0 && (
            <Form compact onSubmit={link}>
              <Field label="Repository">
                <select name="repository" required>
                  {available.map((item) => (
                    <option value={item.value} key={item.value}>{item.label}</option>
                  ))}
                </select>
              </Field>
              <Button busy={busy} type="submit">Link repository <ArrowRight /></Button>
            </Form>
          )}
          {installations.length > 0 && available.length === 0 && (
            <p className="rt-muted">No accessible repositories were returned by the installation.</p>
          )}
        </section>
        <section>
          <h3>Import immutable snapshot</h3>
          {snapshot && repositories.length > 0 ? (
            <Form compact onSubmit={importObject}>
              <Field label="Linked repository">
                <select name="projectRepositoryId" required>
                  {repositories.map((repository) => (
                    <option value={repository.id} key={repository.id}>
                      {repository.ownerLogin}/{repository.repositoryName}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Object type">
                <select name="objectType" defaultValue="pull_request">
                  <option value="issue">Issue → claim</option>
                  <option value="pull_request">Pull request → evidence</option>
                  <option value="commit">Commit → evidence</option>
                  <option value="check_run">Check run → evidence</option>
                  <option value="status">Commit status → evidence</option>
                </select>
              </Field>
              <Field label="Number, SHA, or check-run id">
                <input name="reference" required maxLength={255} />
              </Field>
              <Field label="Link evidence to claim">
                <select name="claimId" defaultValue="">
                  <option value="">No claim link</option>
                  {snapshot.activeClaims.map((claim) => (
                    <option value={claim.id} key={claim.id}>{claim.title}</option>
                  ))}
                </select>
              </Field>
              <FieldRow>
                <Field label="Relation">
                  <select name="relation" defaultValue="supports">
                    <option value="supports">Supports</option>
                    <option value="contradicts">Contradicts</option>
                    <option value="missing">Missing</option>
                  </select>
                </Field>
                <Field label="Evidence kind">
                  <input name="evidenceKind" defaultValue="github" required />
                </Field>
              </FieldRow>
              <Button busy={busy} type="submit">Import snapshot <GithubLogo /></Button>
            </Form>
          ) : (
            <p className="rt-muted">
              Link a repository and open a release before importing.
            </p>
          )}
        </section>
      </div>
      {busy && <p className="rt-muted"><SpinnerGap className="rt-spin" /> Loading GitHub state…</p>}
      {error && <ErrorMessage>{error}</ErrorMessage>}
    </Dialog>
  );
}

function evidenceTimelineStatus(relation) {
  if (relation === "supports") return "verified";
  if (relation === "contradicts") return "contradicted";
  return "pending";
}

function timelineLaneForEvidence(item) {
  if (item.evidenceKind === "claim" || item.sourceType === "claim") return "claim";
  if (["test", "check_run", "status", "check"].includes(item.evidenceKind)) return "test";
  return "code";
}

function decisionTimelineStatus(decision) {
  if (decision.type === "rejection" || decision.status === "rejected") return "contradicted";
  if (decision.type === "approval" && decision.status === "approved") return "verified";
  return "pending";
}

function timelineDayKey(value) {
  return new Date(value).toISOString().slice(0, 10);
}

function formatTimelineDay(dayKey) {
  return new Intl.DateTimeFormat("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(`${dayKey}T00:00:00Z`));
}

function formatTime(value) {
  return new Intl.DateTimeFormat("en", { timeStyle: "short" }).format(
    new Date(value),
  );
}

function formatFullTimestamp(value) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "full",
    timeStyle: "long",
  }).format(new Date(value));
}

function buildAnalysisPayload(event, snapshot) {
  if (!event.claimId) return null;
  const claim = snapshot.activeClaims.find((item) => item.id === event.claimId);
  if (!claim) return null;
  const evidenceIdsForClaim = new Set(
    snapshot.links
      .filter((link) => link.claimId === event.claimId)
      .map((link) => link.evidenceId),
  );
  const sources = snapshot.activeEvidence
    .filter((item) => evidenceIdsForClaim.has(item.id))
    .slice(0, 12)
    .map((item) => ({
      id: item.id,
      kind: item.evidenceKind,
      title: item.summary,
      revision: item.sourceMetadata?.revision || item.id,
      updatedAt: new Date(item.capturedAt).toISOString(),
      content: (item.payloadSnapshot?.content || item.summary).slice(0, 4000),
    }));
  if (sources.length === 0) return null;

  const approvedDecision = snapshot.activeDecisions
    .filter(
      (decision) =>
        decision.claimId === event.claimId &&
        decision.type === "approval" &&
        decision.status === "approved",
    )
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))[0];

  return {
    claim: {
      id: claim.id,
      text: (claim.description || claim.title).slice(0, 600),
      riskType: claim.payloadSnapshot?.riskType || "core_workflow",
      currentRevision: claim.payloadSnapshot?.currentRevision || claim.id,
    },
    focus: {
      eventId: event.id,
      title: event.title.slice(0, 180),
      lane: LANE_TO_FOCUS[event.lane] || "code",
      status: event.status,
      revision: event.detail.revision || claim.payloadSnapshot?.currentRevision || "unknown",
      timestamp: new Date(event.at).toISOString(),
    },
    decision: approvedDecision
      ? {
          id: approvedDecision.id,
          summary: approvedDecision.rationale.slice(0, 400),
          approvedAt: new Date(approvedDecision.createdAt).toISOString(),
          evidenceHead: claim.contentHash || claim.id,
        }
      : null,
    sources,
  };
}

function TimelineTab({ snapshot, focusClaimId, onFocusHandled }) {
  const events = useMemo(() => {
    const claimIdByEvidenceId = new Map(
      snapshot.links.map((link) => [link.evidenceId, link.claimId]),
    );
    const list = [];
    for (const claim of snapshot.activeClaims) {
      list.push({
        id: `claim:${claim.id}`,
        lane: "claim",
        at: claim.createdAt,
        title: claim.title,
        status: "pending",
        statusLabel: "Registered",
        claimId: claim.id,
        detail: {
          kind: "release claim",
          excerpt: claim.acceptanceCriteria,
          hash: claim.contentHash,
        },
      });
    }
    for (const item of snapshot.activeEvidence) {
      const lane = timelineLaneForEvidence(item);
      list.push({
        id: `evidence:${item.id}`,
        lane,
        at: item.capturedAt,
        title: item.summary,
        status: evidenceTimelineStatus(item.relation),
        statusLabel:
          item.relation === "supports"
            ? "Supports"
            : item.relation === "contradicts"
              ? "Contradicts"
              : "Missing evidence",
        claimId: claimIdByEvidenceId.get(item.id),
        detail: {
          kind: `${item.evidenceKind} evidence`,
          relation: item.relation,
          path: item.sourceMetadata?.path,
          revision: item.sourceMetadata?.revision,
          confidence: item.sourceMetadata?.confidence,
          excerpt: item.payloadSnapshot?.content,
          hash: item.contentHash,
          author: item.authorName,
        },
      });
    }
    for (const decision of snapshot.activeDecisions) {
      list.push({
        id: `decision:${decision.id}`,
        lane: "decision",
        at: decision.createdAt,
        title:
          decision.type === "assignment"
            ? `Assigned to ${decision.assignee?.displayName || "a teammate"}`
            : `${decision.type.replace("_", " ")} · ${decision.status}`,
        status: decisionTimelineStatus(decision),
        statusLabel:
          decision.type === "assignment"
            ? "Assigned"
            : decision.status === "approved"
              ? "Approved"
              : decision.status === "rejected"
                ? "Rejected"
                : decision.status === "revoked"
                  ? "Revoked"
                  : "Pending",
        claimId: decision.claimId,
        detail: {
          kind: decision.type === "assignment" ? "blocker assignment" : "human decision",
          excerpt: decision.rationale,
          author: decision.actor?.displayName,
          owner: decision.assignee?.displayName,
          role: decision.roleAtDecision,
        },
      });
    }
    for (const run of snapshot.verdictRuns) {
      list.push({
        id: `verdict:${run.id}`,
        lane: "decision",
        at: run.createdAt,
        title: `Server verdict · ${run.result?.label || "unknown"}`,
        status: run.result?.status === "go" ? "verified" : run.result?.status === "no_go" ? "contradicted" : "pending",
        statusLabel: run.result?.label || "Unknown",
        detail: {
          kind: "deterministic verdict run",
          excerpt: run.result?.detail,
          author: run.actor?.displayName,
        },
      });
    }
    return list.sort((left, right) => Date.parse(left.at) - Date.parse(right.at));
  }, [snapshot]);

  const claimOwners = useMemo(() => {
    const owners = new Map();
    for (const decision of snapshot.activeDecisions) {
      if (decision.type !== "assignment" || !decision.claimId) continue;
      const current = owners.get(decision.claimId);
      if (!current || Date.parse(decision.createdAt) > Date.parse(current.at)) {
        owners.set(decision.claimId, {
          name: decision.assignee?.displayName || "Unknown teammate",
          at: decision.createdAt,
        });
      }
    }
    return owners;
  }, [snapshot.activeDecisions]);

  const days = useMemo(
    () => [...new Set(events.map((event) => timelineDayKey(event.at)))].sort(),
    [events],
  );
  const [selectedId, setSelectedId] = useState(null);
  const boardRef = useRef(null);
  useEffect(() => {
    setSelectedId(null);
    // The newest day carries the release-blocking events; keep it in view.
    boardRef.current?.scrollTo({ left: boardRef.current.scrollWidth });
  }, [snapshot.release.id]);
  const selected =
    events.find((event) => event.id === selectedId) ||
    events.findLast((event) => event.status === "contradicted") ||
    events.at(-1) ||
    null;

  useEffect(() => {
    if (!focusClaimId) return;
    const target =
      events.findLast(
        (event) => event.claimId === focusClaimId && event.status === "contradicted",
      ) || events.findLast((event) => event.claimId === focusClaimId);
    if (target) {
      setSelectedId(target.id);
      boardRef.current
        ?.querySelector(`[data-event-id="${target.id}"]`)
        ?.scrollIntoView({ inline: "center", block: "nearest" });
    }
    onFocusHandled?.();
  }, [focusClaimId, events, onFocusHandled]);

  const [assessing, setAssessing] = useState(false);
  const [assessment, setAssessment] = useState(null);
  const [assessError, setAssessError] = useState("");
  useEffect(() => {
    setAssessment(null);
    setAssessError("");
  }, [selected?.id]);

  async function runAssessment() {
    const payload = buildAnalysisPayload(selected, snapshot);
    if (!payload) return;
    setAssessing(true);
    setAssessError("");
    try {
      const result = await api("/api/analyze", {
        method: "POST",
        marker: "analyze",
        body: payload,
        timeoutMs: 30_000,
      });
      setAssessment(result);
    } catch (requestError) {
      setAssessError(requestError.message);
    } finally {
      setAssessing(false);
    }
  }

  if (events.length === 0) {
    return (
      <EmptyState
        icon={ClockCounterClockwise}
        title="Nothing on the timeline yet"
        body="Attach evidence or record a decision and the release history appears here."
      />
    );
  }

  return (
    <div className="rt-timeline">
      <div
        className="rt-timeline-board"
        role="grid"
        aria-label="Release timeline"
        ref={boardRef}
      >
        <div className="rt-timeline-grid" style={{ "--rt-days": days.length }}>
          <span className="rt-timeline-corner" />
          {days.map((day) => (
            <span className="rt-timeline-day" key={day} title={formatFullTimestamp(`${day}T00:00:00Z`)}>
              {formatTimelineDay(day)}
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
                <div className="rt-timeline-cell" key={day}>
                  {events
                    .filter(
                      (event) =>
                        event.lane === lane.id && timelineDayKey(event.at) === day,
                    )
                    .map((event) => {
                      const status = TIMELINE_STATUS[event.status];
                      return (
                        <button
                          type="button"
                          className={`rt-timeline-event ${event.status} ${
                            selected?.id === event.id ? "selected" : ""
                          }`}
                          onClick={() => setSelectedId(event.id)}
                          key={event.id}
                          data-event-id={event.id}
                        >
                          <status.icon weight="fill" />
                          <span>{event.title}</span>
                          <small title={formatFullTimestamp(event.at)}>{formatTime(event.at)}</small>
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
      {selected && (
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
            <div><dt>Captured</dt><dd title={formatFullTimestamp(selected.at)}>{formatDate(selected.at)}</dd></div>
          </dl>
          {selected.detail.excerpt && (
            <blockquote>{selected.detail.excerpt}</blockquote>
          )}
          {selected.detail.hash && (
            <p className="rt-timeline-hash">
              sha256 <code>{selected.detail.hash.slice(0, 16)}…</code>
            </p>
          )}
          {selected.claimId && (
            <div className="rt-ai-panel">
              <Button
                type="button"
                variant="secondary"
                className="rt-ai-trigger"
                onClick={runAssessment}
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
          )}
        </aside>
      )}
    </div>
  );
}

function ReleaseWorkspace({
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

      <nav className="rt-tabs" role="tablist" aria-label="Release records">
        {tabs.map(([id, label]) => (
          <button
            type="button"
            className={tab === id ? "active" : ""}
            onClick={() => setTab(id)}
            key={id}
            role="tab"
            aria-selected={tab === id}
            aria-controls={`release-panel-${id}`}
            id={`release-tab-${id}`}
          >
            {label}
          </button>
        ))}
      </nav>

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
            <div className="rt-audit-list">
              {[...snapshot.auditEvents].reverse().map((event) => {
                const targetTab = AUDIT_TARGET_TAB[event.targetType];
                const body = (
                  <>
                    <strong>
                      {event.actor?.displayName || "A workspace member"}{" "}
                      {humanizeAuditAction(event.action)}
                    </strong>
                    <small title={formatFullTimestamp(event.createdAt)}>{formatDate(event.createdAt)} · {event.eventHash.slice(0, 12)}…</small>
                  </>
                );
                return (
                  <article key={event.id}>
                    <span><ClockCounterClockwise /></span>
                    {targetTab ? (
                      <button type="button" className="rt-audit-jump" onClick={() => setTab(targetTab)}>
                        {body}
                      </button>
                    ) : (
                      <div>{body}</div>
                    )}
                  </article>
                );
              })}
            </div>
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

function ProductShell({
  user,
  isDemo,
  workspaces,
  workspaceId,
  setWorkspaceId,
  projects,
  projectId,
  setProjectId,
  releases,
  releaseId,
  setReleaseId,
  snapshot,
  loading,
  error,
  onCreate,
  onOpenTeam,
  onOpenGitHub,
  onLogout,
  onRefresh,
  onUpdateStatus,
  onRunVerdict,
  onGenerateExport,
}) {
  const workspace = workspaces.find((item) => item.id === workspaceId);
  const project = projects.find((item) => item.id === projectId);
  const role = workspace?.role;

  return (
    <main className="rt-app">
      <aside className="rt-sidebar">
        <header>
          <Logo />
          <span><strong>Release Truth</strong><small>Evidence Gate</small></span>
          {isDemo && <DemoBadge />}
        </header>
        <div className="rt-workspace-select">
          <span>Workspace</span>
          <label>
            <select value={workspaceId || ""} onChange={(event) => setWorkspaceId(event.target.value)}>
              {workspaces.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
            </select>
            <CaretDown />
          </label>
          <small>{role}</small>
        </div>
        <div className="rt-side-section">
          <div className="rt-side-heading">
            <span>Projects</span>
            {can(role, "create_project") && (
              <button type="button" onClick={() => onCreate("project")} aria-label="New project"><Plus /></button>
            )}
          </div>
          <nav className="rt-projects">
            {projects.map((item) => (
              <button
                type="button"
                className={projectId === item.id ? "active" : ""}
                onClick={() => setProjectId(item.id)}
                key={item.id}
              >
                <Folder weight={projectId === item.id ? "fill" : "regular"} />
                <span>{item.name}</span>
              </button>
            ))}
            {projects.length === 0 && <p>No projects yet.</p>}
          </nav>
          <label className="rt-mobile-project-select">
            <span>Switch project</span>
            <select value={projectId || ""} onChange={(event) => setProjectId(event.target.value)}>
              <option value="">Choose project</option>
              {projects.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
            </select>
          </label>
        </div>
        <div className="rt-side-bottom">
          {can(role, "manage_members") && (
            <button type="button" onClick={onOpenTeam}><UsersThree /> Team</button>
          )}
          {can(role, "manage_integrations") && (
            <button type="button" onClick={onOpenGitHub}><GithubLogo /> GitHub</button>
          )}
          <button type="button" onClick={() => onCreate("workspace")}><Plus /> Workspace</button>
          <button type="button" onClick={onLogout}><SignOut /> Sign out</button>
          <div className="rt-user">
          <Avatar initials={initials(user.displayName)} />
            <span><strong>{user.displayName}</strong><small>{user.email}</small></span>
          </div>
        </div>
      </aside>

      <section className="rt-main">
        {project && (
          <header className="rt-project-bar">
            <div><Folder /><strong>{project.name}</strong></div>
            <label>
              <span>Release</span>
              <select value={releaseId || ""} onChange={(event) => setReleaseId(event.target.value)}>
                <option value="">Choose release</option>
                {releases.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
              </select>
              <CaretDown />
            </label>
            {can(role, "manage_release") && (
              <Button type="button" variant="secondary" onClick={() => onCreate("release")}>
                <Plus /> New release
              </Button>
            )}
          </header>
        )}

        {loading && (
          <div className="rt-loading"><SpinnerGap className="rt-spin" /><span>Loading shared state…</span></div>
        )}
        {!loading && error && (
          <div className="rt-page-error">
            <WarningCircle />
            <h2>Could not load this workspace</h2>
            <p>{error}</p>
            <Button type="button" variant="secondary" onClick={onRefresh}>Try again</Button>
          </div>
        )}
        {!loading && !error && !project && (
          <EmptyState
            icon={Folder}
            title="Create the first project"
            body="Projects group real release targets and their evidence history."
            action={can(role, "create_project") ? () => onCreate("project") : null}
            actionLabel="New project"
          />
        )}
        {!loading && !error && project && releases.length === 0 && (
          <EmptyState
            icon={RocketLaunch}
            title="Create a release to evaluate"
            body="A release pins claims and evidence to a branch, tag, commit, or explicit target."
            action={can(role, "manage_release") ? () => onCreate("release") : null}
            actionLabel="New release"
          />
        )}
        {!loading && !error && project && releases.length > 0 && !releaseId && (
          <div className="rt-release-picker">
            <Kicker>{project.name}</Kicker>
            <h1>Select a release</h1>
            <div>
              {releases.map((item) => (
                <button type="button" key={item.id} onClick={() => setReleaseId(item.id)}>
                  <span><RocketLaunch /></span>
                  <strong>{item.name}</strong>
                  <small>{item.status} · {item.targetValue || "target not set"}</small>
                  <ArrowRight />
                </button>
              ))}
            </div>
          </div>
        )}
        {!loading && !error && snapshot && (
          <ReleaseWorkspace
            key={releaseId}
            snapshot={snapshot}
            onRefresh={onRefresh}
            onCreate={onCreate}
            onUpdateStatus={onUpdateStatus}
            onRunVerdict={onRunVerdict}
            onGenerateExport={onGenerateExport}
          />
        )}
      </section>
    </main>
  );
}

export function ProductApp() {
  const [status, setStatus] = useState("loading");
  const [user, setUser] = useState(null);
  const [workspaces, setWorkspaces] = useState([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState("");
  const [releases, setReleases] = useState([]);
  const [releaseId, setReleaseId] = useState("");
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState(null);
  const acceptedInvite = useRef(false);
  const projectRequest = useRef({ controller: null, sequence: 0 });
  const releaseRequest = useRef({ controller: null, sequence: 0 });
  const snapshotRequest = useRef({ controller: null, sequence: 0 });
  const invitation =
    typeof window === "undefined"
      ? null
      : new URLSearchParams(window.location.search).get("invite");

  const loadIdentity = useCallback(async () => {
    try {
      const result = await api("/api/auth/me");
      if (!result.user) {
        setStatus("guest");
        setUser(null);
        setWorkspaces([]);
        return;
      }
      setUser(result.user);
      setWorkspaces(result.workspaces);
      setWorkspaceId((current) =>
        result.workspaces.some((item) => item.id === current)
          ? current
          : result.workspaces[0]?.id || "",
      );
      setStatus("authenticated");
    } catch (requestError) {
      if (requestError.status === 401) {
        setStatus("guest");
        setUser(null);
        return;
      }
      setError(requestError.message);
      setStatus("guest");
    }
  }, []);

  useEffect(() => {
    void loadIdentity();
  }, [loadIdentity]);

  useEffect(() => {
    if (status !== "authenticated" || !invitation || acceptedInvite.current) return;
    acceptedInvite.current = true;
    void (async () => {
      try {
        await api("/api/invitations/accept", {
          method: "POST",
          marker: markers.invitationAccept,
          body: { token: invitation },
        });
      } catch (requestError) {
        if (requestError.status !== 410) setError(requestError.message);
      } finally {
        window.history.replaceState({}, "", window.location.pathname);
        await loadIdentity();
      }
    })();
  }, [invitation, loadIdentity, status]);

  const loadProjects = useCallback(async () => {
    projectRequest.current.controller?.abort();
    const controller = new AbortController();
    const sequence = ++projectRequest.current.sequence;
    projectRequest.current.controller = controller;
    if (!workspaceId) {
      setProjects([]);
      setProjectId("");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await api(`/api/workspaces/${workspaceId}/projects`, { signal: controller.signal });
      if (sequence !== projectRequest.current.sequence) return;
      setProjects(result.projects);
      setProjectId((current) =>
        result.projects.some((item) => item.id === current)
          ? current
          : result.projects[0]?.id || "",
      );
    } catch (requestError) {
      if (controller.signal.aborted || sequence !== projectRequest.current.sequence) return;
      setError(requestError.message);
    } finally {
      if (sequence === projectRequest.current.sequence) setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    setReleaseId("");
    setSnapshot(null);
    void loadProjects();
  }, [loadProjects]);

  const loadReleases = useCallback(async () => {
    releaseRequest.current.controller?.abort();
    const controller = new AbortController();
    const sequence = ++releaseRequest.current.sequence;
    releaseRequest.current.controller = controller;
    if (!projectId) {
      setReleases([]);
      setReleaseId("");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await api(`/api/projects/${projectId}/releases`, { signal: controller.signal });
      if (sequence !== releaseRequest.current.sequence) return;
      setReleases(result.releases);
      setReleaseId((current) =>
        result.releases.some((item) => item.id === current)
          ? current
          : result.releases[0]?.id || "",
      );
    } catch (requestError) {
      if (controller.signal.aborted || sequence !== releaseRequest.current.sequence) return;
      setError(requestError.message);
    } finally {
      if (sequence === releaseRequest.current.sequence) setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    setSnapshot(null);
    void loadReleases();
  }, [loadReleases]);

  const loadSnapshot = useCallback(async () => {
    snapshotRequest.current.controller?.abort();
    const controller = new AbortController();
    const sequence = ++snapshotRequest.current.sequence;
    snapshotRequest.current.controller = controller;
    if (!releaseId) {
      setSnapshot(null);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await api(`/api/releases/${releaseId}`, { signal: controller.signal });
      if (sequence !== snapshotRequest.current.sequence) return;
      setSnapshot(result);
    } catch (requestError) {
      if (controller.signal.aborted || sequence !== snapshotRequest.current.sequence) return;
      setError(requestError.message);
      setSnapshot(null);
    } finally {
      if (sequence === snapshotRequest.current.sequence) setLoading(false);
    }
  }, [releaseId]);

  useEffect(() => {
    void loadSnapshot();
  }, [loadSnapshot]);

  async function createWorkspace(payload) {
    const result = await api("/api/workspaces", {
      method: "POST",
      marker: markers.workspace,
      body: payload,
    });
    await loadIdentity();
    setWorkspaceId(result.workspace.id);
  }

  async function createRecord(type, payload) {
    let path;
    if (type === "workspace") return createWorkspace(payload);
    if (type === "project") path = `/api/workspaces/${workspaceId}/projects`;
    if (type === "release") path = `/api/projects/${projectId}/releases`;
    if (type === "claim") path = `/api/releases/${releaseId}/claims`;
    if (type === "evidence") path = `/api/releases/${releaseId}/evidence`;
    if (type === "decision") path = `/api/releases/${releaseId}/decisions`;
    const result = await api(path, {
      method: "POST",
      marker: markers[type],
      body: payload,
    });
    if (type === "project") {
      await loadProjects();
      setProjectId(result.project.id);
    }
    if (type === "release") {
      await loadReleases();
      setReleaseId(result.release.id);
    }
    if (type === "claim" || type === "evidence" || type === "decision") {
      await loadSnapshot();
    }
  }

  async function logout() {
    try {
      await api("/api/auth/logout", {
        method: "POST",
        marker: markers.logout,
        body: {},
      });
    } finally {
      setStatus("guest");
      setUser(null);
      setWorkspaces([]);
    }
  }

  async function updateStatus(nextStatus) {
    try {
      await api(`/api/releases/${releaseId}`, {
        method: "PATCH",
        marker: markers.releaseUpdate,
        body: { status: nextStatus },
      });
      await loadSnapshot();
      await loadReleases();
    } catch (requestError) {
      setError(requestError.message);
      throw requestError;
    }
  }

  async function runVerdict() {
    try {
      await api(`/api/releases/${releaseId}/verdict-runs`, {
        method: "POST",
        marker: markers.verdict,
        body: {},
      });
      await loadSnapshot();
    } catch (requestError) {
      setError(requestError.message);
      throw requestError;
    }
  }

  async function generateExport() {
    try {
      const payload = await api(`/api/releases/${releaseId}/exports`, {
        method: "POST",
        marker: markers.export,
        body: {},
      });
      const blob = new Blob([JSON.stringify(payload.export, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `release-truth-${snapshot.release.name}-${payload.artifact.id}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      await loadSnapshot();
    } catch (requestError) {
      setError(requestError.message);
      throw requestError;
    }
  }

  if (status === "loading") {
    return (
      <main className="rt-boot">
        <Logo />
        <SpinnerGap className="rt-spin" />
      </main>
    );
  }
  if (status === "guest") {
    return (
      <AuthScreen
        invitation={invitation}
        bootError={error}
        onAuthenticated={loadIdentity}
      />
    );
  }
  if (workspaces.length === 0) {
    return <EmptyWorkspace user={user} onCreate={createWorkspace} />;
  }

  const workspace = workspaces.find((item) => item.id === workspaceId);
  const project = projects.find((item) => item.id === projectId);

  return (
    <>
      <ProductShell
        user={user}
        isDemo={user?.isDemo}
        workspaces={workspaces}
        workspaceId={workspaceId}
        setWorkspaceId={setWorkspaceId}
        projects={projects}
        projectId={projectId}
        setProjectId={setProjectId}
        releases={releases}
        releaseId={releaseId}
        setReleaseId={setReleaseId}
        snapshot={snapshot}
        loading={loading}
        error={error}
        onCreate={setDialog}
        onOpenTeam={() => setDialog("team")}
        onOpenGitHub={() => setDialog("github")}
        onLogout={logout}
        onRefresh={loadSnapshot}
        onUpdateStatus={updateStatus}
        onRunVerdict={runVerdict}
        onGenerateExport={generateExport}
      />
      {dialog && !["team", "github"].includes(dialog) && (
        <CreationDialog
          type={dialog}
          context={{
            workspace,
            project,
            release: snapshot?.release,
            claims: snapshot?.activeClaims || [],
            evidence: snapshot?.activeEvidence || [],
            links: snapshot?.links || [],
          }}
          onClose={() => setDialog(null)}
          onCreated={createRecord}
        />
      )}
      {dialog === "team" && workspace && (
        <TeamDialog workspace={workspace} onClose={() => setDialog(null)} />
      )}
      {dialog === "github" && workspace && (
        <GitHubDialog
          workspace={workspace}
          project={project}
          snapshot={snapshot}
          onClose={() => setDialog(null)}
          onImported={loadSnapshot}
        />
      )}
    </>
  );
}
