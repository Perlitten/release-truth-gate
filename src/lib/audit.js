import { AUDIT_ACTION_PHRASES } from "./audit-constants.js";

export function humanizeAuditAction(action) {
  if (AUDIT_ACTION_PHRASES[action]) return AUDIT_ACTION_PHRASES[action];
  if (action.startsWith("release.")) {
    return `moved the release to ${action.slice("release.".length).replace("_", " ")}`;
  }
  const [scope, verb] = action.split(".");
  return `${verb?.replace(/_/g, " ") || "updated"} the ${scope || "record"}`;
}
