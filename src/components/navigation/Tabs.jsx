export function Tabs({ tabs, active, onChange }) {
  return (
    <nav className="rt-tabs" role="tablist" aria-label="Release records">
      {tabs.map(([id, label]) => (
        <button
          type="button"
          className={active === id ? "active" : ""}
          onClick={() => onChange(id)}
          key={id}
          role="tab"
          aria-selected={active === id}
          aria-controls={`release-panel-${id}`}
          id={`release-tab-${id}`}
        >
          {label}
        </button>
      ))}
    </nav>
  );
}
