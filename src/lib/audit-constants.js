export const EVIDENCE_RELATION_PRIORITY = { contradicts: 0, missing: 1, supports: 2 };

export const AUDIT_ACTION_PHRASES = {
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

export const AUDIT_TARGET_TAB = {
  claim: "claims",
  evidence: "evidence",
  decision: "decisions",
  verdict_run: "timeline",
  export_artifact: "audit",
  release: "overview",
};
