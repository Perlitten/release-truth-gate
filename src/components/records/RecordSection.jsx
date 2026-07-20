import { Plus } from "@phosphor-icons/react";
import { Button } from "../core/Button.jsx";

export function RecordSection({ title, description, action, actionLabel, children }) {
  return (
    <section className="rt-record-section">
      <header>
        <div><h2>{title}</h2><p>{description}</p></div>
        {action && (
          <Button type="button" variant="primary" onClick={action}>
            <Plus /> {actionLabel}
          </Button>
        )}
      </header>
      {children}
    </section>
  );
}
