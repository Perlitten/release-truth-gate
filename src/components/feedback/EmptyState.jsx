import { Plus } from "@phosphor-icons/react";
import { Button } from "../core/Button.jsx";

export function EmptyState({ icon: Icon, title, body, action, actionLabel }) {
  return (
    <div className="rt-empty">
      <span><Icon weight="duotone" /></span>
      <h3>{title}</h3>
      <p>{body}</p>
      {action && (
        <Button type="button" variant="primary" onClick={action}>
          <Plus /> {actionLabel}
        </Button>
      )}
    </div>
  );
}
