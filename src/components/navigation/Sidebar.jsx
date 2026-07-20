import { CaretDown, Plus, Folder, UsersThree, GithubLogo, SignOut } from "@phosphor-icons/react";
import { Logo } from "../core/Logo.jsx";
import { DemoBadge } from "../core/DemoBadge.jsx";
import { Avatar } from "../core/Avatar.jsx";

export function Sidebar({
  isDemo,
  workspaces,
  workspaceId,
  onSelectWorkspace,
  role,
  canCreateProject,
  projects,
  projectId,
  onSelectProject,
  canManageMembers,
  canManageIntegrations,
  onOpenTeam,
  onOpenGitHub,
  onCreate,
  onLogout,
  user,
  userInitials,
}) {
  return (
    <aside className="rt-sidebar">
      <header>
        <Logo />
        <span><strong>Release Truth</strong><small>Evidence Gate</small></span>
        {isDemo && <DemoBadge />}
      </header>
      <div className="rt-workspace-select">
        <span>Workspace</span>
        <label>
          <select value={workspaceId || ""} onChange={(event) => onSelectWorkspace(event.target.value)}>
            {workspaces.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
          </select>
          <CaretDown />
        </label>
        <small>{role}</small>
      </div>
      <div className="rt-side-section">
        <div className="rt-side-heading">
          <span>Projects</span>
          {canCreateProject && (
            <button type="button" onClick={() => onCreate("project")} aria-label="New project"><Plus /></button>
          )}
        </div>
        <nav className="rt-projects">
          {projects.map((item) => (
            <button
              type="button"
              className={projectId === item.id ? "active" : ""}
              onClick={() => onSelectProject(item.id)}
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
          <select value={projectId || ""} onChange={(event) => onSelectProject(event.target.value)}>
            <option value="">Choose project</option>
            {projects.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
          </select>
        </label>
      </div>
      <div className="rt-side-bottom">
        {canManageMembers && (
          <button type="button" onClick={onOpenTeam}><UsersThree /> Team</button>
        )}
        {canManageIntegrations && (
          <button type="button" onClick={onOpenGitHub}><GithubLogo /> GitHub</button>
        )}
        <button type="button" onClick={() => onCreate("workspace")}><Plus /> Workspace</button>
        <button type="button" onClick={onLogout}><SignOut /> Sign out</button>
        <div className="rt-user">
        <Avatar initials={userInitials} />
          <span><strong>{user.displayName}</strong><small>{user.email}</small></span>
        </div>
      </div>
    </aside>
  );
}
