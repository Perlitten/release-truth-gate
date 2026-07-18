import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const createdAt = () =>
  timestamp("created_at", { withTimezone: true, mode: "date" })
    .defaultNow()
    .notNull();

const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true, mode: "date" })
    .defaultNow()
    .notNull();

export const workspaceRole = pgEnum("workspace_role", [
  "owner",
  "admin",
  "contributor",
  "reviewer",
  "viewer",
]);

export const releaseStatus = pgEnum("release_status", [
  "draft",
  "in_review",
  "finalized",
  "archived",
]);

export const releaseTargetType = pgEnum("release_target_type", [
  "branch",
  "tag",
  "commit",
  "unspecified",
]);

export const claimSourceType = pgEnum("claim_source_type", [
  "manual",
  "github_issue",
]);

export const evidenceSourceType = pgEnum("evidence_source_type", [
  "manual",
  "github_pull_request",
  "github_commit",
  "github_check_run",
  "github_status",
]);

export const immutableRecordAction = pgEnum("immutable_record_action", [
  "snapshot",
  "correction",
  "revocation",
]);

export const decisionType = pgEnum("decision_type", [
  "approval",
  "rejection",
  "risk_acceptance",
  "comment",
]);

export const decisionStatus = pgEnum("decision_status", [
  "pending",
  "approved",
  "rejected",
  "revoked",
]);

export const githubInstallationStatus = pgEnum("github_installation_status", [
  "active",
  "suspended",
  "deleted",
]);

export const githubImportObjectType = pgEnum("github_import_object_type", [
  "issue",
  "pull_request",
  "commit",
  "check_run",
  "status",
]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull(),
    displayName: text("display_name").notNull(),
    passwordHash: text("password_hash").notNull(),
    passwordSalt: text("password_salt").notNull(),
    passwordIterations: integer("password_iterations").notNull(),
    emailVerifiedAt: timestamp("email_verified_at", {
      withTimezone: true,
      mode: "date",
    }),
    disabledAt: timestamp("disabled_at", { withTimezone: true, mode: "date" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("users_email_lower_unique").on(sql`lower(${table.email})`),
    check(
      "users_password_iterations_check",
      sql`${table.passwordIterations} >= 100000`,
    ),
    check(
      "users_display_name_length_check",
      sql`char_length(${table.displayName}) between 2 and 120`,
    ),
  ],
);

export const userSessions = pgTable(
  "user_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    lastSeenAt: timestamp("last_seen_at", {
      withTimezone: true,
      mode: "date",
    })
      .defaultNow()
      .notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "date" }),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("user_sessions_token_hash_unique").on(table.tokenHash),
    index("user_sessions_user_id_idx").on(table.userId),
    index("user_sessions_expires_at_idx").on(table.expiresAt),
    check(
      "user_sessions_token_hash_check",
      sql`char_length(${table.tokenHash}) = 64`,
    ),
  ],
);

export const workspaces = pgTable(
  "workspaces",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("workspaces_slug_lower_unique").on(sql`lower(${table.slug})`),
    check(
      "workspaces_name_length_check",
      sql`char_length(${table.name}) between 2 and 120`,
    ),
    check(
      "workspaces_slug_format_check",
      sql`${table.slug} ~ '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$'`,
    ),
  ],
);

export const memberships = pgTable(
  "memberships",
  {
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: workspaceRole("role").notNull(),
    invitedBy: uuid("invited_by").references(() => users.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    primaryKey({
      name: "memberships_workspace_user_pk",
      columns: [table.workspaceId, table.userId],
    }),
    index("memberships_user_id_idx").on(table.userId),
  ],
);

export const invitations = pgTable(
  "invitations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: workspaceRole("role").notNull(),
    tokenHash: text("token_hash").notNull(),
    invitedBy: uuid("invited_by")
      .notNull()
      .references(() => users.id),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true, mode: "date" }),
    acceptedBy: uuid("accepted_by").references(() => users.id),
    revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "date" }),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("invitations_token_hash_unique").on(table.tokenHash),
    index("invitations_workspace_email_idx").on(
      table.workspaceId,
      sql`lower(${table.email})`,
    ),
    check(
      "invitations_token_hash_check",
      sql`char_length(${table.tokenHash}) = 64`,
    ),
  ],
);

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    archivedAt: timestamp("archived_at", { withTimezone: true, mode: "date" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("projects_workspace_id_idx").on(table.workspaceId),
    uniqueIndex("projects_workspace_name_unique").on(
      table.workspaceId,
      sql`lower(${table.name})`,
    ),
    check(
      "projects_name_length_check",
      sql`char_length(${table.name}) between 2 and 160`,
    ),
  ],
);

export const releases = pgTable(
  "releases",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    status: releaseStatus("status").notNull().default("draft"),
    targetType: releaseTargetType("target_type")
      .notNull()
      .default("unspecified"),
    targetValue: text("target_value"),
    finalizedAt: timestamp("finalized_at", { withTimezone: true, mode: "date" }),
    finalizedBy: uuid("finalized_by").references(() => users.id),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("releases_project_id_idx").on(table.projectId),
    uniqueIndex("releases_project_name_unique").on(
      table.projectId,
      sql`lower(${table.name})`,
    ),
    check(
      "releases_name_length_check",
      sql`char_length(${table.name}) between 1 and 160`,
    ),
    check(
      "releases_target_value_check",
      sql`(${table.targetType} = 'unspecified' and ${table.targetValue} is null) or (${table.targetType} <> 'unspecified' and char_length(${table.targetValue}) between 1 and 255)`,
    ),
  ],
);

export const claims = pgTable(
  "claims",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    releaseId: uuid("release_id")
      .notNull()
      .references(() => releases.id, { onDelete: "cascade" }),
    sourceType: claimSourceType("source_type").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    acceptanceCriteria: text("acceptance_criteria").notNull(),
    sourceReference: text("source_reference"),
    externalUrl: text("external_url"),
    externalReference: text("external_reference"),
    payloadSnapshot: jsonb("payload_snapshot").notNull(),
    material: boolean("material").notNull().default(true),
    requiredEvidenceKinds: jsonb("required_evidence_kinds").notNull(),
    recordAction: immutableRecordAction("record_action")
      .notNull()
      .default("snapshot"),
    supersedesId: uuid("supersedes_id").references(() => claims.id),
    correctionReason: text("correction_reason"),
    contentHash: text("content_hash").notNull(),
    authoredBy: uuid("authored_by")
      .notNull()
      .references(() => users.id),
    capturedAt: timestamp("captured_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    index("claims_release_id_idx").on(table.releaseId),
    index("claims_supersedes_id_idx").on(table.supersedesId),
    uniqueIndex("claims_release_content_revision_unique").on(
      table.releaseId,
      table.sourceType,
      table.externalReference,
      table.contentHash,
    ),
    check("claims_content_hash_check", sql`char_length(${table.contentHash}) = 64`),
    check(
      "claims_supersession_reason_check",
      sql`(${table.recordAction} = 'snapshot' and ${table.supersedesId} is null) or (${table.recordAction} <> 'snapshot' and ${table.supersedesId} is not null and char_length(${table.correctionReason}) >= 8)`,
    ),
  ],
);

export const evidence = pgTable(
  "evidence",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    releaseId: uuid("release_id")
      .notNull()
      .references(() => releases.id, { onDelete: "cascade" }),
    sourceType: evidenceSourceType("source_type").notNull(),
    externalReference: text("external_reference"),
    sourceUrl: text("source_url"),
    payloadSnapshot: jsonb("payload_snapshot").notNull(),
    summary: text("summary").notNull(),
    authorName: text("author_name"),
    sourceMetadata: jsonb("source_metadata").notNull().default({}),
    relation: text("relation").notNull().default("missing"),
    evidenceKind: text("evidence_kind").notNull(),
    recordAction: immutableRecordAction("record_action")
      .notNull()
      .default("snapshot"),
    supersedesId: uuid("supersedes_id").references(() => evidence.id),
    correctionReason: text("correction_reason"),
    contentHash: text("content_hash").notNull(),
    capturedAt: timestamp("captured_at", { withTimezone: true, mode: "date" }).notNull(),
    authoredBy: uuid("authored_by")
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
  },
  (table) => [
    index("evidence_release_id_idx").on(table.releaseId),
    index("evidence_supersedes_id_idx").on(table.supersedesId),
    uniqueIndex("evidence_release_content_revision_unique").on(
      table.releaseId,
      table.sourceType,
      table.externalReference,
      table.contentHash,
    ),
    check(
      "evidence_relation_check",
      sql`${table.relation} in ('supports', 'contradicts', 'missing')`,
    ),
    check(
      "evidence_content_hash_check",
      sql`char_length(${table.contentHash}) = 64`,
    ),
    check(
      "evidence_supersession_reason_check",
      sql`(${table.recordAction} = 'snapshot' and ${table.supersedesId} is null) or (${table.recordAction} <> 'snapshot' and ${table.supersedesId} is not null and char_length(${table.correctionReason}) >= 8)`,
    ),
  ],
);

export const claimEvidenceLinks = pgTable(
  "claim_evidence_links",
  {
    claimId: uuid("claim_id")
      .notNull()
      .references(() => claims.id, { onDelete: "restrict" }),
    evidenceId: uuid("evidence_id")
      .notNull()
      .references(() => evidence.id, { onDelete: "restrict" }),
    linkedBy: uuid("linked_by")
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
  },
  (table) => [
    primaryKey({
      name: "claim_evidence_links_pk",
      columns: [table.claimId, table.evidenceId],
    }),
    index("claim_evidence_links_evidence_id_idx").on(table.evidenceId),
  ],
);

export const decisions = pgTable(
  "decisions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    releaseId: uuid("release_id")
      .notNull()
      .references(() => releases.id, { onDelete: "cascade" }),
    claimId: uuid("claim_id").references(() => claims.id, { onDelete: "restrict" }),
    verdictRunId: uuid("verdict_run_id"),
    type: decisionType("type").notNull(),
    status: decisionStatus("status").notNull(),
    rationale: text("rationale").notNull(),
    roleAtDecision: workspaceRole("role_at_decision").notNull(),
    basedOnEvidenceIds: jsonb("based_on_evidence_ids").notNull().default([]),
    recordAction: immutableRecordAction("record_action")
      .notNull()
      .default("snapshot"),
    supersedesId: uuid("supersedes_id").references(() => decisions.id),
    correctionReason: text("correction_reason"),
    contentHash: text("content_hash").notNull(),
    authoredBy: uuid("authored_by")
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
  },
  (table) => [
    index("decisions_release_id_idx").on(table.releaseId),
    index("decisions_claim_id_idx").on(table.claimId),
    index("decisions_supersedes_id_idx").on(table.supersedesId),
    check(
      "decisions_content_hash_check",
      sql`char_length(${table.contentHash}) = 64`,
    ),
    check(
      "decisions_target_check",
      sql`${table.claimId} is not null or ${table.verdictRunId} is not null`,
    ),
    check(
      "decisions_supersession_reason_check",
      sql`(${table.recordAction} = 'snapshot' and ${table.supersedesId} is null) or (${table.recordAction} <> 'snapshot' and ${table.supersedesId} is not null and char_length(${table.correctionReason}) >= 8)`,
    ),
  ],
);

export const verdictRuns = pgTable(
  "verdict_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    releaseId: uuid("release_id")
      .notNull()
      .references(() => releases.id, { onDelete: "cascade" }),
    engineVersion: text("engine_version").notNull(),
    policyVersion: text("policy_version").notNull(),
    inputSnapshot: jsonb("input_snapshot").notNull(),
    inputDigest: text("input_digest").notNull(),
    result: jsonb("result").notNull(),
    reasonCodes: jsonb("reason_codes").notNull(),
    initiatedBy: uuid("initiated_by")
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
  },
  (table) => [
    index("verdict_runs_release_id_created_at_idx").on(
      table.releaseId,
      table.createdAt,
    ),
    uniqueIndex("verdict_runs_reproducible_unique").on(
      table.releaseId,
      table.engineVersion,
      table.inputDigest,
    ),
    check(
      "verdict_runs_input_digest_check",
      sql`char_length(${table.inputDigest}) = 64`,
    ),
  ],
);

export const githubInstallations = pgTable(
  "github_installations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    installationId: text("installation_id").notNull(),
    accountLogin: text("account_login").notNull(),
    accountId: text("account_id").notNull(),
    accountType: text("account_type").notNull(),
    repositorySelection: text("repository_selection").notNull(),
    status: githubInstallationStatus("status").notNull().default("active"),
    installedBy: uuid("installed_by")
      .notNull()
      .references(() => users.id),
    suspendedAt: timestamp("suspended_at", { withTimezone: true, mode: "date" }),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("github_installations_installation_id_unique").on(
      table.installationId,
    ),
    index("github_installations_workspace_id_idx").on(table.workspaceId),
  ],
);

export const githubOauthStates = pgTable(
  "github_oauth_states",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    initiatedBy: uuid("initiated_by")
      .notNull()
      .references(() => users.id),
    stateHash: text("state_hash").notNull(),
    installationId: text("installation_id"),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true, mode: "date" }),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("github_oauth_states_hash_unique").on(table.stateHash),
    check(
      "github_oauth_states_hash_check",
      sql`char_length(${table.stateHash}) = 64`,
    ),
  ],
);

export const projectRepositories = pgTable(
  "project_repositories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    githubInstallationId: uuid("github_installation_id")
      .notNull()
      .references(() => githubInstallations.id, { onDelete: "restrict" }),
    repositoryId: text("repository_id").notNull(),
    ownerLogin: text("owner_login").notNull(),
    repositoryName: text("repository_name").notNull(),
    defaultBranch: text("default_branch").notNull(),
    repositoryUrl: text("repository_url").notNull(),
    active: boolean("active").notNull().default(true),
    linkedBy: uuid("linked_by")
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("project_repositories_project_repository_unique").on(
      table.projectId,
      table.repositoryId,
    ),
    index("project_repositories_installation_id_idx").on(
      table.githubInstallationId,
    ),
  ],
);

export const integrationImports = pgTable(
  "integration_imports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectRepositoryId: uuid("project_repository_id")
      .notNull()
      .references(() => projectRepositories.id, { onDelete: "restrict" }),
    releaseId: uuid("release_id")
      .notNull()
      .references(() => releases.id, { onDelete: "cascade" }),
    objectType: githubImportObjectType("object_type").notNull(),
    externalId: text("external_id").notNull(),
    externalUrl: text("external_url").notNull(),
    normalizedPayload: jsonb("normalized_payload").notNull(),
    payloadHash: text("payload_hash").notNull(),
    importedClaimId: uuid("imported_claim_id").references(() => claims.id, {
      onDelete: "restrict",
    }),
    importedEvidenceId: uuid("imported_evidence_id").references(() => evidence.id, {
      onDelete: "restrict",
    }),
    importedBy: uuid("imported_by")
      .notNull()
      .references(() => users.id),
    importedAt: timestamp("imported_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("integration_imports_idempotency_unique").on(
      table.projectRepositoryId,
      table.objectType,
      table.externalId,
      table.payloadHash,
    ),
    index("integration_imports_release_id_idx").on(table.releaseId),
    check(
      "integration_imports_payload_hash_check",
      sql`char_length(${table.payloadHash}) = 64`,
    ),
    check(
      "integration_imports_result_check",
      sql`num_nonnulls(${table.importedClaimId}, ${table.importedEvidenceId}) = 1`,
    ),
  ],
);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id").references(() => users.id),
    actorRole: workspaceRole("actor_role"),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: uuid("target_id"),
    metadata: jsonb("metadata").notNull().default({}),
    previousEventHash: text("previous_event_hash"),
    eventHash: text("event_hash").notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    index("audit_events_workspace_created_at_idx").on(
      table.workspaceId,
      table.createdAt,
    ),
    check("audit_events_hash_check", sql`char_length(${table.eventHash}) = 64`),
    check(
      "audit_events_previous_hash_check",
      sql`${table.previousEventHash} is null or char_length(${table.previousEventHash}) = 64`,
    ),
  ],
);

export const exportArtifacts = pgTable(
  "export_artifacts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    releaseId: uuid("release_id")
      .notNull()
      .references(() => releases.id, { onDelete: "cascade" }),
    verdictRunId: uuid("verdict_run_id")
      .notNull()
      .references(() => verdictRuns.id, { onDelete: "restrict" }),
    formatVersion: integer("format_version").notNull(),
    manifest: jsonb("manifest").notNull(),
    artifactHash: text("artifact_hash").notNull(),
    signatureAlgorithm: text("signature_algorithm").notNull(),
    publicKeyId: text("public_key_id").notNull(),
    signature: text("signature").notNull(),
    generatedBy: uuid("generated_by")
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
  },
  (table) => [
    index("export_artifacts_release_created_at_idx").on(
      table.releaseId,
      table.createdAt,
    ),
    check(
      "export_artifacts_hash_check",
      sql`char_length(${table.artifactHash}) = 64`,
    ),
    check(
      "export_artifacts_format_version_check",
      sql`${table.formatVersion} >= 1`,
    ),
  ],
);
