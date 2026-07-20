const capabilities = {
  owner: new Set(["create_project", "manage_release", "create_claim", "create_evidence", "create_decision", "run_verdict", "generate_export", "manage_members", "manage_integrations"]),
  admin: new Set(["create_project", "manage_release", "create_claim", "create_evidence", "create_decision", "run_verdict", "generate_export", "manage_members", "manage_integrations"]),
  contributor: new Set(["create_project", "manage_release", "create_claim", "create_evidence", "run_verdict", "generate_export"]),
  reviewer: new Set(["create_decision", "run_verdict", "generate_export"]),
  viewer: new Set(["generate_export"]),
};

export function can(role, capability) {
  return capabilities[role]?.has(capability) || false;
}
