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
  Folder,
  GithubLogo,
  LockKey,
  Plus,
  RocketLaunch,
  ShieldCheck,
  SignOut,
  Sparkle,
  SpinnerGap,
  UserPlus,
  UsersThree,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
  owner: new Set(["project", "release", "claim", "evidence", "decision", "verdict", "export", "members", "integrations"]),
  admin: new Set(["project", "release", "claim", "evidence", "decision", "verdict", "export", "members", "integrations"]),
  contributor: new Set(["project", "release", "claim", "evidence", "verdict", "export"]),
  reviewer: new Set(["decision", "verdict", "export"]),
  viewer: new Set(["export"]),
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
      signal: AbortSignal.timeout(20_000),
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

function Field({ label, hint, children }) {
  return (
    <label className="rt-field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

function Dialog({ title, eyebrow, children, onClose, wide = false }) {
  useEffect(() => {
    const close = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onClose]);

  return (
    <div className="rt-dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className={`rt-dialog ${wide ? "wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <span>{eyebrow}</span>
            <h2>{title}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close">
            <X />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}

function SubmitButton({ busy, children }) {
  return (
    <button className="rt-primary" type="submit" disabled={busy}>
      {busy ? <SpinnerGap className="rt-spin" /> : children}
    </button>
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
        <div className="rt-logo large"><Sparkle weight="fill" /></div>
        <p className="rt-kicker">Release Truth</p>
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
          <div className="rt-notice">
            <UserPlus /> Sign in with the invited email to join the workspace.
          </div>
        )}
        <form className="rt-form" onSubmit={submit}>
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
          {error && <p className="rt-error"><WarningCircle /> {error}</p>}
          <SubmitButton busy={busy}>
            {mode === "register" ? "Create account" : "Sign in"} <ArrowRight />
          </SubmitButton>
        </form>
        <button
          className="rt-secondary rt-demo-entry"
          type="button"
          disabled={busy}
          onClick={enterDemo}
        >
          <Sparkle weight="fill" /> Explore the Nova 2.4 demo
        </button>
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
        <div className="rt-logo"><Sparkle weight="fill" /></div>
        <span className="rt-kicker">Welcome, {user.displayName}</span>
        <h1>Create your first workspace</h1>
        <p>
          Workspaces keep projects, release evidence, teammates, and audit history
          under one authorization boundary.
        </p>
        <form className="rt-form rt-onboarding-form" onSubmit={submit}>
          <Field label="Workspace name" hint="For example: Platform team">
            <input name="name" minLength={2} maxLength={120} required autoFocus />
          </Field>
          {error && <p className="rt-error"><WarningCircle /> {error}</p>}
          <SubmitButton busy={busy}>Create workspace <ArrowRight /></SubmitButton>
        </form>
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
    const data = new FormData(event.currentTarget);
    let payload;
    if (type === "workspace") payload = { name: data.get("name") };
    if (type === "project") {
      payload = { name: data.get("name"), description: data.get("description") };
    }
    if (type === "release") {
      const targetType = data.get("targetType");
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
      <form className="rt-form" onSubmit={submit}>
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
            <div className="rt-field-row">
              <Field label="Target type">
                <select name="targetType" defaultValue="tag">
                  <option value="tag">Git tag</option>
                  <option value="branch">Branch</option>
                  <option value="commit">Commit</option>
                  <option value="unspecified">Not set yet</option>
                </select>
              </Field>
              <Field label="Target value">
                <input name="targetValue" placeholder="v1.0.0" maxLength={255} />
              </Field>
            </div>
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
            <label className="rt-check">
              <input type="checkbox" name="material" defaultChecked />
              <span>Material to the release verdict</span>
            </label>
          </>
        )}
        {type === "evidence" && (
          <>
            <Field label="Evidence summary">
              <textarea name="summary" rows={4} minLength={2} required autoFocus />
            </Field>
            <div className="rt-field-row">
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
            </div>
            <Field label="Link to one or more claims">
              <div className="rt-checkbox-list">
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
              </div>
            </Field>
            <Field label="Source URL" hint="Optional. Must be a complete https:// URL.">
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
              <select name="decisionType" defaultValue="approval">
                <option value="approval">Approve current evidence head</option>
                <option value="rejection">Reject</option>
                <option value="risk_acceptance">Accept documented risk</option>
                <option value="comment">Reviewer comment</option>
              </select>
            </Field>
            <Field label="Rationale" hint="At least 12 characters. Explain why the evidence is sufficient or insufficient.">
              <textarea name="rationale" rows={4} minLength={12} required />
            </Field>
            <Field label="Evidence considered">
              <div className="rt-checkbox-list">
                {context.evidence
                  .filter((item) =>
                    context.links.some(
                      (link) =>
                        link.claimId === decisionClaimId &&
                        link.evidenceId === item.id,
                    ),
                  )
                  .map((item) => (
                  <label key={item.id}>
                    <input
                      type="checkbox"
                      name="basedOnEvidenceIds"
                      value={item.id}
                      defaultChecked
                    />
                    <span>{item.summary}</span>
                  </label>
                  ))}
              </div>
            </Field>
          </>
        )}
        {error && <p className="rt-error"><WarningCircle /> {error}</p>}
        <div className="rt-dialog-actions">
          <button type="button" className="rt-secondary" onClick={onClose}>Cancel</button>
          <SubmitButton busy={busy}>Create record <ArrowRight /></SubmitButton>
        </div>
      </form>
    </Dialog>
  );
}

function TeamDialog({ workspace, onClose }) {
  const [members, setMembers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");

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
                  <span className="rt-avatar">{initials(member.displayName)}</span>
                  <span><strong>{member.displayName}</strong><small>{member.email}</small></span>
                  <b>{member.role}</b>
                </div>
              ))}
            </div>
          )}
        </section>
        <section>
          <h3>Invite teammate</h3>
          <form className="rt-form compact" onSubmit={invite}>
            <Field label="Email"><input type="email" name="email" required /></Field>
            <Field label="Role">
              <select name="role" defaultValue="reviewer">
                <option value="admin">Admin</option>
                <option value="contributor">Contributor</option>
                <option value="reviewer">Reviewer</option>
                <option value="viewer">Viewer</option>
              </select>
            </Field>
            <SubmitButton busy={busy}>Create invite <UserPlus /></SubmitButton>
          </form>
          {inviteUrl && (
            <div className="rt-invite-link">
              <span>Single-use invite link</span>
              <input value={inviteUrl} readOnly onFocus={(event) => event.target.select()} />
              <button type="button" onClick={() => navigator.clipboard.writeText(inviteUrl)}>
                Copy link
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
      {error && <p className="rt-error"><WarningCircle /> {error}</p>}
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
          <button type="button" className="rt-secondary" onClick={connect} disabled={busy}>
            <GithubLogo /> Connect GitHub App
          </button>
          {project && available.length > 0 && (
            <form className="rt-form compact" onSubmit={link}>
              <Field label="Repository">
                <select name="repository" required>
                  {available.map((item) => (
                    <option value={item.value} key={item.value}>{item.label}</option>
                  ))}
                </select>
              </Field>
              <SubmitButton busy={busy}>Link repository <ArrowRight /></SubmitButton>
            </form>
          )}
          {installations.length > 0 && available.length === 0 && (
            <p className="rt-muted">No accessible repositories were returned by the installation.</p>
          )}
        </section>
        <section>
          <h3>Import immutable snapshot</h3>
          {snapshot && repositories.length > 0 ? (
            <form className="rt-form compact" onSubmit={importObject}>
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
              <div className="rt-field-row">
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
              </div>
              <SubmitButton busy={busy}>Import snapshot <GithubLogo /></SubmitButton>
            </form>
          ) : (
            <p className="rt-muted">
              Link a repository and open a release before importing.
            </p>
          )}
        </section>
      </div>
      {busy && <p className="rt-muted"><SpinnerGap className="rt-spin" /> Loading GitHub state…</p>}
      {error && <p className="rt-error"><WarningCircle /> {error}</p>}
    </Dialog>
  );
}

function RecordSection({ title, description, action, actionLabel, children }) {
  return (
    <section className="rt-record-section">
      <header>
        <div><h2>{title}</h2><p>{description}</p></div>
        {action && (
          <button type="button" className="rt-primary" onClick={action}>
            <Plus /> {actionLabel}
          </button>
        )}
      </header>
      {children}
    </section>
  );
}

function EmptyState({ icon: Icon, title, body, action, actionLabel }) {
  return (
    <div className="rt-empty">
      <span><Icon weight="duotone" /></span>
      <h3>{title}</h3>
      <p>{body}</p>
      {action && (
        <button type="button" className="rt-primary" onClick={action}>
          <Plus /> {actionLabel}
        </button>
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
  const [tab, setTab] = useState("overview");
  const [busy, setBusy] = useState(false);
  const role = snapshot.membership.role;
  const latestRun = snapshot.verdictRuns.at(-1) || null;
  const claimLinks = useMemo(() => {
    const counts = new Map();
    for (const link of snapshot.links) {
      counts.set(link.claimId, (counts.get(link.claimId) || 0) + 1);
    }
    return counts;
  }, [snapshot.links]);

  async function changeStatus(status) {
    setBusy(true);
    try {
      await onUpdateStatus(status);
    } finally {
      setBusy(false);
    }
  }

  async function runVerdict() {
    setBusy(true);
    try {
      await onRunVerdict();
    } finally {
      setBusy(false);
    }
  }

  async function generateExport() {
    setBusy(true);
    try {
      await onGenerateExport();
    } finally {
      setBusy(false);
    }
  }

  const tabs = [
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
          <span className={`rt-state ${snapshot.release.status}`}>
            {snapshot.release.status.replace("_", " ")}
          </span>
          <button type="button" className="rt-secondary" onClick={onRefresh}>
            <ArrowClockwise /> Refresh
          </button>
          {can(role, "verdict") && (
            <button
              type="button"
              className="rt-primary"
              onClick={runVerdict}
              disabled={busy}
            >
              <ShieldCheck /> Run verdict
            </button>
          )}
          {can(role, "export") && latestRun && (
            <button
              type="button"
              className="rt-secondary"
              onClick={generateExport}
              disabled={busy}
            >
              <DownloadSimple /> Signed export
            </button>
          )}
          {can(role, "release") && snapshot.release.status !== "finalized" && (
            <button
              type="button"
              className="rt-primary"
              onClick={() => changeStatus("finalized")}
              disabled={busy}
            >
              <CheckCircle /> Finalize
            </button>
          )}
          {can(role, "release") && snapshot.release.status === "finalized" && (
            <button
              type="button"
              className="rt-secondary"
              onClick={() => changeStatus("in_review")}
              disabled={busy}
            >
              Reopen review
            </button>
          )}
        </div>
      </header>

      <nav className="rt-tabs">
        {tabs.map(([id, label]) => (
          <button
            type="button"
            className={tab === id ? "active" : ""}
            onClick={() => setTab(id)}
            key={id}
          >
            {label}
          </button>
        ))}
      </nav>

      <section className="rt-release-content">
        {tab === "overview" && (
          <>
            <div className="rt-metrics">
              <article>
                <span>Material claims</span>
                <strong>{snapshot.activeClaims.filter((claim) => claim.material).length}</strong>
                <small>Authoritative snapshots</small>
              </article>
              <article>
                <span>Evidence records</span>
                <strong>{snapshot.activeEvidence.length}</strong>
                <small>{snapshot.links.length} claim links</small>
              </article>
              <article>
                <span>Human decisions</span>
                <strong>{snapshot.activeDecisions.length}</strong>
                <small>Append-only review log</small>
              </article>
              <article className={latestRun?.result?.status || "neutral"}>
                <span>Server verdict</span>
                <strong>{latestRun?.result?.label || "NOT RUN"}</strong>
                <small>{latestRun ? formatDate(latestRun.createdAt) : "No stored verdict run"}</small>
              </article>
            </div>
            <div className="rt-overview-grid">
              <article className="rt-trust-card">
                <div>
                  <span className="rt-kicker">Trust boundary</span>
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
                action={can(role, "claim") ? () => onCreate("claim") : null}
                actionLabel="Add first claim"
              />
            )}
          </>
        )}

        {tab === "claims" && (
          <RecordSection
            title="Release claims"
            description="Immutable statements the team must prove before shipping."
            action={can(role, "claim") ? () => onCreate("claim") : null}
            actionLabel="Add claim"
          >
            {snapshot.activeClaims.length === 0 ? (
              <EmptyState icon={ClipboardText} title="No claims yet" body="Create the first release claim." />
            ) : (
              <div className="rt-record-list">
                {snapshot.activeClaims.map((claim) => (
                  <article className="rt-record" key={claim.id}>
                    <div className="rt-record-mark claim"><ClipboardText /></div>
                    <div>
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
                    </div>
                  </article>
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
              can(role, "evidence") && snapshot.activeClaims.length > 0
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
              />
            ) : (
              <div className="rt-record-list">
                {snapshot.activeEvidence.map((item) => (
                  <article className="rt-record" key={item.id}>
                    <div className={`rt-record-mark ${item.relation}`}>
                      {item.relation === "supports" ? <CheckCircle /> : <WarningCircle />}
                    </div>
                    <div>
                      <div className="rt-record-title">
                        <h3>{item.summary}</h3>
                        <span className={item.relation}>{item.relation}</span>
                      </div>
                      <dl>
                        <div><dt>Kind</dt><dd>{item.evidenceKind}</dd></div>
                        <div><dt>Captured</dt><dd>{formatDate(item.capturedAt)}</dd></div>
                      </dl>
                      {item.sourceUrl && (
                        <a href={item.sourceUrl} target="_blank" rel="noreferrer">Open source</a>
                      )}
                      <small>hash {item.contentHash.slice(0, 12)}…</small>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </RecordSection>
        )}

        {tab === "decisions" && (
          <RecordSection
            title="Review decisions"
            description="Every review is attributed to an authenticated workspace member."
            action={
              can(role, "decision") &&
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
                  <article className="rt-record" key={decision.id}>
                    <div className="rt-record-mark decision"><ShieldCheck /></div>
                    <div>
                      <div className="rt-record-title">
                        <h3>{decision.type.replace("_", " ")}</h3>
                        <span>{decision.status}</span>
                      </div>
                      <p>{decision.rationale}</p>
                      <small>{decision.actor.displayName} · {formatDate(decision.createdAt)}</small>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </RecordSection>
        )}

        {tab === "audit" && (
          <RecordSection
            title="Tamper-evident audit"
            description="Each event includes the hash of the previous workspace event."
          >
            <div className="rt-audit-list">
              {[...snapshot.auditEvents].reverse().map((event) => (
                <article key={event.id}>
                  <span><ClockCounterClockwise /></span>
                  <div>
                    <strong>{event.action}</strong>
                    <small>{formatDate(event.createdAt)} · {event.eventHash.slice(0, 12)}…</small>
                  </div>
                </article>
              ))}
            </div>
          </RecordSection>
        )}
      </section>
    </div>
  );
}

function ProductShell({
  user,
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
          <span className="rt-logo"><Sparkle weight="fill" /></span>
          <span><strong>Release Truth</strong><small>Evidence Gate</small></span>
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
            {can(role, "project") && (
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
        </div>
        <div className="rt-side-bottom">
          {can(role, "members") && (
            <button type="button" onClick={onOpenTeam}><UsersThree /> Team</button>
          )}
          {can(role, "integrations") && (
            <button type="button" onClick={onOpenGitHub}><GithubLogo /> GitHub</button>
          )}
          <button type="button" onClick={() => onCreate("workspace")}><Plus /> Workspace</button>
          <button type="button" onClick={onLogout}><SignOut /> Sign out</button>
          <div className="rt-user">
            <span className="rt-avatar">{initials(user.displayName)}</span>
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
            {can(role, "release") && (
              <button type="button" className="rt-secondary" onClick={() => onCreate("release")}>
                <Plus /> New release
              </button>
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
            <button className="rt-secondary" type="button" onClick={onRefresh}>Try again</button>
          </div>
        )}
        {!loading && !error && !project && (
          <EmptyState
            icon={Folder}
            title="Create the first project"
            body="Projects group real release targets and their evidence history."
            action={can(role, "project") ? () => onCreate("project") : null}
            actionLabel="New project"
          />
        )}
        {!loading && !error && project && releases.length === 0 && (
          <EmptyState
            icon={RocketLaunch}
            title="Create a release to evaluate"
            body="A release pins claims and evidence to a branch, tag, commit, or explicit target."
            action={can(role, "release") ? () => onCreate("release") : null}
            actionLabel="New release"
          />
        )}
        {!loading && !error && project && releases.length > 0 && !releaseId && (
          <div className="rt-release-picker">
            <span className="rt-kicker">{project.name}</span>
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
    if (!workspaceId) {
      setProjects([]);
      setProjectId("");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await api(`/api/workspaces/${workspaceId}/projects`);
      setProjects(result.projects);
      setProjectId((current) =>
        result.projects.some((item) => item.id === current)
          ? current
          : result.projects[0]?.id || "",
      );
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    setReleaseId("");
    setSnapshot(null);
    void loadProjects();
  }, [loadProjects]);

  const loadReleases = useCallback(async () => {
    if (!projectId) {
      setReleases([]);
      setReleaseId("");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await api(`/api/projects/${projectId}/releases`);
      setReleases(result.releases);
      setReleaseId((current) =>
        result.releases.some((item) => item.id === current)
          ? current
          : result.releases[0]?.id || "",
      );
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    setSnapshot(null);
    void loadReleases();
  }, [loadReleases]);

  const loadSnapshot = useCallback(async () => {
    if (!releaseId) {
      setSnapshot(null);
      return;
    }
    setLoading(true);
    setError("");
    try {
      setSnapshot(await api(`/api/releases/${releaseId}`));
    } catch (requestError) {
      setError(requestError.message);
      setSnapshot(null);
    } finally {
      setLoading(false);
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
    await api(`/api/releases/${releaseId}`, {
      method: "PATCH",
      marker: markers.releaseUpdate,
      body: { status: nextStatus },
    });
    await loadSnapshot();
    await loadReleases();
  }

  async function runVerdict() {
    await api(`/api/releases/${releaseId}/verdict-runs`, {
      method: "POST",
      marker: markers.verdict,
      body: {},
    });
    await loadSnapshot();
  }

  async function generateExport() {
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
  }

  if (status === "loading") {
    return (
      <main className="rt-boot">
        <span className="rt-logo"><Sparkle weight="fill" /></span>
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
