import { Folder, CaretDown, Plus } from "@phosphor-icons/react";
import { Button } from "../core/Button.jsx";

export function ProjectBar({
  projectName,
  releases,
  selectedReleaseId,
  onSelectRelease,
  canManageRelease,
  onCreate,
}) {
  return (
    <header className="rt-project-bar">
      <div><Folder /><strong>{projectName}</strong></div>
      <label>
        <span>Release</span>
        <select value={selectedReleaseId || ""} onChange={(event) => onSelectRelease(event.target.value)}>
          <option value="">Choose release</option>
          {releases.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
        </select>
        <CaretDown />
      </label>
      {canManageRelease && (
        <Button type="button" variant="secondary" onClick={() => onCreate("release")}>
          <Plus /> New release
        </Button>
      )}
    </header>
  );
}
