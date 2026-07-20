"use client";

import { Folder, RocketLaunch, SpinnerGap, WarningCircle } from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "./components/core/Button.jsx";
import { Logo } from "./components/core/Logo.jsx";
import { EmptyState } from "./components/feedback/EmptyState.jsx";
import { Sidebar } from "./components/navigation/Sidebar.jsx";
import { ProjectBar } from "./components/navigation/ProjectBar.jsx";
import { ReleasePicker } from "./components/navigation/ReleasePicker.jsx";
import { CreationDialog } from "./components/dialogs/CreationDialog.jsx";
import { TeamDialog } from "./components/dialogs/TeamDialog.jsx";
import { GitHubDialog } from "./components/dialogs/GitHubDialog.jsx";
import { AuthScreen } from "./screens/AuthScreen.jsx";
import { EmptyWorkspace } from "./screens/EmptyWorkspace.jsx";
import { ReleaseWorkspace } from "./screens/ReleaseWorkspace.jsx";
import { api, markers } from "./lib/api.js";
import { can } from "./lib/rbac.js";
import { initials } from "./lib/format.js";

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
      <Sidebar
        isDemo={isDemo}
        workspaces={workspaces}
        workspaceId={workspaceId}
        onSelectWorkspace={setWorkspaceId}
        role={role}
        canCreateProject={can(role, "create_project")}
        projects={projects}
        projectId={projectId}
        onSelectProject={setProjectId}
        canManageMembers={can(role, "manage_members")}
        canManageIntegrations={can(role, "manage_integrations")}
        onOpenTeam={onOpenTeam}
        onOpenGitHub={onOpenGitHub}
        onCreate={onCreate}
        onLogout={onLogout}
        user={user}
        userInitials={initials(user.displayName)}
      />

      <section className="rt-main">
        {project && (
          <ProjectBar
            projectName={project.name}
            releases={releases}
            selectedReleaseId={releaseId}
            onSelectRelease={setReleaseId}
            canManageRelease={can(role, "manage_release")}
            onCreate={onCreate}
          />
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
          <ReleasePicker
            projectName={project.name}
            releases={releases}
            onPick={setReleaseId}
          />
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
