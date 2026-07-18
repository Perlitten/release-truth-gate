CREATE TYPE "public"."claim_source_type" AS ENUM('manual', 'github_issue');--> statement-breakpoint
CREATE TYPE "public"."decision_status" AS ENUM('pending', 'approved', 'rejected', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."decision_type" AS ENUM('approval', 'rejection', 'risk_acceptance', 'comment');--> statement-breakpoint
CREATE TYPE "public"."evidence_source_type" AS ENUM('manual', 'github_pull_request', 'github_commit', 'github_check_run', 'github_status');--> statement-breakpoint
CREATE TYPE "public"."github_import_object_type" AS ENUM('issue', 'pull_request', 'commit', 'check_run', 'status');--> statement-breakpoint
CREATE TYPE "public"."github_installation_status" AS ENUM('active', 'suspended', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."immutable_record_action" AS ENUM('snapshot', 'correction', 'revocation');--> statement-breakpoint
CREATE TYPE "public"."release_status" AS ENUM('draft', 'in_review', 'finalized', 'archived');--> statement-breakpoint
CREATE TYPE "public"."release_target_type" AS ENUM('branch', 'tag', 'commit', 'unspecified');--> statement-breakpoint
CREATE TYPE "public"."workspace_role" AS ENUM('owner', 'admin', 'contributor', 'reviewer', 'viewer');--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"actor_id" uuid,
	"actor_role" "workspace_role",
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"previous_event_hash" text,
	"event_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audit_events_hash_check" CHECK (char_length("audit_events"."event_hash") = 64),
	CONSTRAINT "audit_events_previous_hash_check" CHECK ("audit_events"."previous_event_hash" is null or char_length("audit_events"."previous_event_hash") = 64)
);
--> statement-breakpoint
CREATE TABLE "claim_evidence_links" (
	"claim_id" uuid NOT NULL,
	"evidence_id" uuid NOT NULL,
	"linked_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "claim_evidence_links_pk" PRIMARY KEY("claim_id","evidence_id")
);
--> statement-breakpoint
CREATE TABLE "claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"release_id" uuid NOT NULL,
	"source_type" "claim_source_type" NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"acceptance_criteria" text NOT NULL,
	"source_reference" text,
	"external_url" text,
	"external_reference" text,
	"payload_snapshot" jsonb NOT NULL,
	"material" boolean DEFAULT true NOT NULL,
	"required_evidence_kinds" jsonb NOT NULL,
	"record_action" "immutable_record_action" DEFAULT 'snapshot' NOT NULL,
	"supersedes_id" uuid,
	"correction_reason" text,
	"content_hash" text NOT NULL,
	"authored_by" uuid NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "claims_content_hash_check" CHECK (char_length("claims"."content_hash") = 64),
	CONSTRAINT "claims_supersession_reason_check" CHECK (("claims"."record_action" = 'snapshot' and "claims"."supersedes_id" is null) or ("claims"."record_action" <> 'snapshot' and "claims"."supersedes_id" is not null and char_length("claims"."correction_reason") >= 8))
);
--> statement-breakpoint
CREATE TABLE "decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"release_id" uuid NOT NULL,
	"claim_id" uuid,
	"verdict_run_id" uuid,
	"type" "decision_type" NOT NULL,
	"status" "decision_status" NOT NULL,
	"rationale" text NOT NULL,
	"role_at_decision" "workspace_role" NOT NULL,
	"based_on_evidence_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"record_action" "immutable_record_action" DEFAULT 'snapshot' NOT NULL,
	"supersedes_id" uuid,
	"correction_reason" text,
	"content_hash" text NOT NULL,
	"authored_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "decisions_content_hash_check" CHECK (char_length("decisions"."content_hash") = 64),
	CONSTRAINT "decisions_target_check" CHECK ("decisions"."claim_id" is not null or "decisions"."verdict_run_id" is not null),
	CONSTRAINT "decisions_supersession_reason_check" CHECK (("decisions"."record_action" = 'snapshot' and "decisions"."supersedes_id" is null) or ("decisions"."record_action" <> 'snapshot' and "decisions"."supersedes_id" is not null and char_length("decisions"."correction_reason") >= 8))
);
--> statement-breakpoint
CREATE TABLE "evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"release_id" uuid NOT NULL,
	"source_type" "evidence_source_type" NOT NULL,
	"external_reference" text,
	"source_url" text,
	"payload_snapshot" jsonb NOT NULL,
	"summary" text NOT NULL,
	"author_name" text,
	"source_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"relation" text DEFAULT 'missing' NOT NULL,
	"evidence_kind" text NOT NULL,
	"record_action" "immutable_record_action" DEFAULT 'snapshot' NOT NULL,
	"supersedes_id" uuid,
	"correction_reason" text,
	"content_hash" text NOT NULL,
	"captured_at" timestamp with time zone NOT NULL,
	"authored_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "evidence_relation_check" CHECK ("evidence"."relation" in ('supports', 'contradicts', 'missing')),
	CONSTRAINT "evidence_content_hash_check" CHECK (char_length("evidence"."content_hash") = 64),
	CONSTRAINT "evidence_supersession_reason_check" CHECK (("evidence"."record_action" = 'snapshot' and "evidence"."supersedes_id" is null) or ("evidence"."record_action" <> 'snapshot' and "evidence"."supersedes_id" is not null and char_length("evidence"."correction_reason") >= 8))
);
--> statement-breakpoint
CREATE TABLE "export_artifacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"release_id" uuid NOT NULL,
	"verdict_run_id" uuid NOT NULL,
	"format_version" integer NOT NULL,
	"manifest" jsonb NOT NULL,
	"artifact_hash" text NOT NULL,
	"signature_algorithm" text NOT NULL,
	"public_key_id" text NOT NULL,
	"signature" text NOT NULL,
	"generated_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "export_artifacts_hash_check" CHECK (char_length("export_artifacts"."artifact_hash") = 64),
	CONSTRAINT "export_artifacts_format_version_check" CHECK ("export_artifacts"."format_version" >= 1)
);
--> statement-breakpoint
CREATE TABLE "github_installations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"installation_id" text NOT NULL,
	"account_login" text NOT NULL,
	"account_id" text NOT NULL,
	"account_type" text NOT NULL,
	"repository_selection" text NOT NULL,
	"status" "github_installation_status" DEFAULT 'active' NOT NULL,
	"installed_by" uuid NOT NULL,
	"suspended_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "github_oauth_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"initiated_by" uuid NOT NULL,
	"state_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "github_oauth_states_hash_check" CHECK (char_length("github_oauth_states"."state_hash") = 64)
);
--> statement-breakpoint
CREATE TABLE "integration_imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_repository_id" uuid NOT NULL,
	"release_id" uuid NOT NULL,
	"object_type" "github_import_object_type" NOT NULL,
	"external_id" text NOT NULL,
	"external_url" text NOT NULL,
	"normalized_payload" jsonb NOT NULL,
	"payload_hash" text NOT NULL,
	"imported_claim_id" uuid,
	"imported_evidence_id" uuid,
	"imported_by" uuid NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "integration_imports_payload_hash_check" CHECK (char_length("integration_imports"."payload_hash") = 64),
	CONSTRAINT "integration_imports_result_check" CHECK (num_nonnulls("integration_imports"."imported_claim_id", "integration_imports"."imported_evidence_id") = 1)
);
--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" "workspace_role" NOT NULL,
	"token_hash" text NOT NULL,
	"invited_by" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"accepted_by" uuid,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invitations_token_hash_check" CHECK (char_length("invitations"."token_hash") = 64)
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "workspace_role" NOT NULL,
	"invited_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "memberships_workspace_user_pk" PRIMARY KEY("workspace_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "project_repositories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"github_installation_id" uuid NOT NULL,
	"repository_id" text NOT NULL,
	"owner_login" text NOT NULL,
	"repository_name" text NOT NULL,
	"default_branch" text NOT NULL,
	"repository_url" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"linked_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"created_by" uuid NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "projects_name_length_check" CHECK (char_length("projects"."name") between 2 and 160)
);
--> statement-breakpoint
CREATE TABLE "releases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"status" "release_status" DEFAULT 'draft' NOT NULL,
	"target_type" "release_target_type" DEFAULT 'unspecified' NOT NULL,
	"target_value" text,
	"finalized_at" timestamp with time zone,
	"finalized_by" uuid,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "releases_name_length_check" CHECK (char_length("releases"."name") between 1 and 160),
	CONSTRAINT "releases_target_value_check" CHECK (("releases"."target_type" = 'unspecified' and "releases"."target_value" is null) or ("releases"."target_type" <> 'unspecified' and char_length("releases"."target_value") between 1 and 255))
);
--> statement-breakpoint
CREATE TABLE "user_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_sessions_token_hash_check" CHECK (char_length("user_sessions"."token_hash") = 64)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"display_name" text NOT NULL,
	"password_hash" text NOT NULL,
	"password_salt" text NOT NULL,
	"password_iterations" integer NOT NULL,
	"email_verified_at" timestamp with time zone,
	"disabled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_password_iterations_check" CHECK ("users"."password_iterations" >= 100000),
	CONSTRAINT "users_display_name_length_check" CHECK (char_length("users"."display_name") between 2 and 120)
);
--> statement-breakpoint
CREATE TABLE "verdict_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"release_id" uuid NOT NULL,
	"engine_version" text NOT NULL,
	"policy_version" text NOT NULL,
	"input_snapshot" jsonb NOT NULL,
	"input_digest" text NOT NULL,
	"result" jsonb NOT NULL,
	"reason_codes" jsonb NOT NULL,
	"initiated_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "verdict_runs_input_digest_check" CHECK (char_length("verdict_runs"."input_digest") = 64)
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspaces_name_length_check" CHECK (char_length("workspaces"."name") between 2 and 120),
	CONSTRAINT "workspaces_slug_format_check" CHECK ("workspaces"."slug" ~ '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$')
);
--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim_evidence_links" ADD CONSTRAINT "claim_evidence_links_claim_id_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claims"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim_evidence_links" ADD CONSTRAINT "claim_evidence_links_evidence_id_evidence_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."evidence"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim_evidence_links" ADD CONSTRAINT "claim_evidence_links_linked_by_users_id_fk" FOREIGN KEY ("linked_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_supersedes_id_claims_id_fk" FOREIGN KEY ("supersedes_id") REFERENCES "public"."claims"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_authored_by_users_id_fk" FOREIGN KEY ("authored_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_claim_id_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claims"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_supersedes_id_decisions_id_fk" FOREIGN KEY ("supersedes_id") REFERENCES "public"."decisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_authored_by_users_id_fk" FOREIGN KEY ("authored_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_supersedes_id_evidence_id_fk" FOREIGN KEY ("supersedes_id") REFERENCES "public"."evidence"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_authored_by_users_id_fk" FOREIGN KEY ("authored_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "export_artifacts" ADD CONSTRAINT "export_artifacts_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "export_artifacts" ADD CONSTRAINT "export_artifacts_verdict_run_id_verdict_runs_id_fk" FOREIGN KEY ("verdict_run_id") REFERENCES "public"."verdict_runs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "export_artifacts" ADD CONSTRAINT "export_artifacts_generated_by_users_id_fk" FOREIGN KEY ("generated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "github_installations" ADD CONSTRAINT "github_installations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "github_installations" ADD CONSTRAINT "github_installations_installed_by_users_id_fk" FOREIGN KEY ("installed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "github_oauth_states" ADD CONSTRAINT "github_oauth_states_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "github_oauth_states" ADD CONSTRAINT "github_oauth_states_initiated_by_users_id_fk" FOREIGN KEY ("initiated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_imports" ADD CONSTRAINT "integration_imports_project_repository_id_project_repositories_id_fk" FOREIGN KEY ("project_repository_id") REFERENCES "public"."project_repositories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_imports" ADD CONSTRAINT "integration_imports_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_imports" ADD CONSTRAINT "integration_imports_imported_claim_id_claims_id_fk" FOREIGN KEY ("imported_claim_id") REFERENCES "public"."claims"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_imports" ADD CONSTRAINT "integration_imports_imported_evidence_id_evidence_id_fk" FOREIGN KEY ("imported_evidence_id") REFERENCES "public"."evidence"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_imports" ADD CONSTRAINT "integration_imports_imported_by_users_id_fk" FOREIGN KEY ("imported_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_accepted_by_users_id_fk" FOREIGN KEY ("accepted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_repositories" ADD CONSTRAINT "project_repositories_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_repositories" ADD CONSTRAINT "project_repositories_github_installation_id_github_installations_id_fk" FOREIGN KEY ("github_installation_id") REFERENCES "public"."github_installations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_repositories" ADD CONSTRAINT "project_repositories_linked_by_users_id_fk" FOREIGN KEY ("linked_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "releases" ADD CONSTRAINT "releases_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "releases" ADD CONSTRAINT "releases_finalized_by_users_id_fk" FOREIGN KEY ("finalized_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "releases" ADD CONSTRAINT "releases_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verdict_runs" ADD CONSTRAINT "verdict_runs_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verdict_runs" ADD CONSTRAINT "verdict_runs_initiated_by_users_id_fk" FOREIGN KEY ("initiated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_events_workspace_created_at_idx" ON "audit_events" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "claim_evidence_links_evidence_id_idx" ON "claim_evidence_links" USING btree ("evidence_id");--> statement-breakpoint
CREATE INDEX "claims_release_id_idx" ON "claims" USING btree ("release_id");--> statement-breakpoint
CREATE INDEX "claims_supersedes_id_idx" ON "claims" USING btree ("supersedes_id");--> statement-breakpoint
CREATE UNIQUE INDEX "claims_release_content_revision_unique" ON "claims" USING btree ("release_id","source_type","external_reference","content_hash");--> statement-breakpoint
CREATE INDEX "decisions_release_id_idx" ON "decisions" USING btree ("release_id");--> statement-breakpoint
CREATE INDEX "decisions_claim_id_idx" ON "decisions" USING btree ("claim_id");--> statement-breakpoint
CREATE INDEX "decisions_supersedes_id_idx" ON "decisions" USING btree ("supersedes_id");--> statement-breakpoint
CREATE INDEX "evidence_release_id_idx" ON "evidence" USING btree ("release_id");--> statement-breakpoint
CREATE INDEX "evidence_supersedes_id_idx" ON "evidence" USING btree ("supersedes_id");--> statement-breakpoint
CREATE UNIQUE INDEX "evidence_release_content_revision_unique" ON "evidence" USING btree ("release_id","source_type","external_reference","content_hash");--> statement-breakpoint
CREATE INDEX "export_artifacts_release_created_at_idx" ON "export_artifacts" USING btree ("release_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "github_installations_installation_id_unique" ON "github_installations" USING btree ("installation_id");--> statement-breakpoint
CREATE INDEX "github_installations_workspace_id_idx" ON "github_installations" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "github_oauth_states_hash_unique" ON "github_oauth_states" USING btree ("state_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "integration_imports_idempotency_unique" ON "integration_imports" USING btree ("project_repository_id","object_type","external_id","payload_hash");--> statement-breakpoint
CREATE INDEX "integration_imports_release_id_idx" ON "integration_imports" USING btree ("release_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invitations_token_hash_unique" ON "invitations" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "invitations_workspace_email_idx" ON "invitations" USING btree ("workspace_id",lower("email"));--> statement-breakpoint
CREATE INDEX "memberships_user_id_idx" ON "memberships" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_repositories_project_repository_unique" ON "project_repositories" USING btree ("project_id","repository_id");--> statement-breakpoint
CREATE INDEX "project_repositories_installation_id_idx" ON "project_repositories" USING btree ("github_installation_id");--> statement-breakpoint
CREATE INDEX "projects_workspace_id_idx" ON "projects" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "projects_workspace_name_unique" ON "projects" USING btree ("workspace_id",lower("name"));--> statement-breakpoint
CREATE INDEX "releases_project_id_idx" ON "releases" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "releases_project_name_unique" ON "releases" USING btree ("project_id",lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "user_sessions_token_hash_unique" ON "user_sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "user_sessions_user_id_idx" ON "user_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_sessions_expires_at_idx" ON "user_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_lower_unique" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "verdict_runs_release_id_created_at_idx" ON "verdict_runs" USING btree ("release_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "verdict_runs_reproducible_unique" ON "verdict_runs" USING btree ("release_id","engine_version","input_digest");--> statement-breakpoint
CREATE UNIQUE INDEX "workspaces_slug_lower_unique" ON "workspaces" USING btree (lower("slug"));--> statement-breakpoint
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_verdict_run_id_verdict_runs_id_fk" FOREIGN KEY ("verdict_run_id") REFERENCES "public"."verdict_runs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint

CREATE OR REPLACE FUNCTION release_truth_reject_immutable_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'release_truth_immutable_record: % on % is forbidden', TG_OP, TG_TABLE_NAME
    USING ERRCODE = '55000';
END;
$$;--> statement-breakpoint

CREATE TRIGGER claims_immutable
BEFORE UPDATE OR DELETE ON claims
FOR EACH ROW EXECUTE FUNCTION release_truth_reject_immutable_mutation();--> statement-breakpoint
CREATE TRIGGER evidence_immutable
BEFORE UPDATE OR DELETE ON evidence
FOR EACH ROW EXECUTE FUNCTION release_truth_reject_immutable_mutation();--> statement-breakpoint
CREATE TRIGGER claim_evidence_links_immutable
BEFORE UPDATE OR DELETE ON claim_evidence_links
FOR EACH ROW EXECUTE FUNCTION release_truth_reject_immutable_mutation();--> statement-breakpoint
CREATE TRIGGER decisions_immutable
BEFORE UPDATE OR DELETE ON decisions
FOR EACH ROW EXECUTE FUNCTION release_truth_reject_immutable_mutation();--> statement-breakpoint
CREATE TRIGGER verdict_runs_immutable
BEFORE UPDATE OR DELETE ON verdict_runs
FOR EACH ROW EXECUTE FUNCTION release_truth_reject_immutable_mutation();--> statement-breakpoint
CREATE TRIGGER integration_imports_immutable
BEFORE UPDATE OR DELETE ON integration_imports
FOR EACH ROW EXECUTE FUNCTION release_truth_reject_immutable_mutation();--> statement-breakpoint
CREATE TRIGGER audit_events_immutable
BEFORE UPDATE OR DELETE ON audit_events
FOR EACH ROW EXECUTE FUNCTION release_truth_reject_immutable_mutation();--> statement-breakpoint
CREATE TRIGGER export_artifacts_immutable
BEFORE UPDATE OR DELETE ON export_artifacts
FOR EACH ROW EXECUTE FUNCTION release_truth_reject_immutable_mutation();--> statement-breakpoint

CREATE OR REPLACE FUNCTION release_truth_validate_claim_evidence_link()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM claims c
    JOIN evidence e ON e.id = NEW.evidence_id
    WHERE c.id = NEW.claim_id
      AND c.release_id = e.release_id
  ) THEN
    RAISE EXCEPTION 'claim and evidence must belong to the same release'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint

CREATE TRIGGER claim_evidence_links_same_release
BEFORE INSERT ON claim_evidence_links
FOR EACH ROW EXECUTE FUNCTION release_truth_validate_claim_evidence_link();--> statement-breakpoint

CREATE OR REPLACE FUNCTION release_truth_validate_append_only_chain()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  parent_release_id uuid;
BEGIN
  IF NEW.supersedes_id IS NULL THEN
    RETURN NEW;
  END IF;

  EXECUTE format('SELECT release_id FROM %I WHERE id = $1', TG_TABLE_NAME)
    INTO parent_release_id
    USING NEW.supersedes_id;

  IF parent_release_id IS NULL OR parent_release_id <> NEW.release_id THEN
    RAISE EXCEPTION 'superseded record must exist in the same release'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;--> statement-breakpoint

CREATE TRIGGER claims_append_only_chain
BEFORE INSERT ON claims
FOR EACH ROW EXECUTE FUNCTION release_truth_validate_append_only_chain();--> statement-breakpoint
CREATE TRIGGER evidence_append_only_chain
BEFORE INSERT ON evidence
FOR EACH ROW EXECUTE FUNCTION release_truth_validate_append_only_chain();--> statement-breakpoint
CREATE TRIGGER decisions_append_only_chain
BEFORE INSERT ON decisions
FOR EACH ROW EXECUTE FUNCTION release_truth_validate_append_only_chain();--> statement-breakpoint

CREATE OR REPLACE FUNCTION release_truth_validate_decision_target()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.claim_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM claims
    WHERE id = NEW.claim_id AND release_id = NEW.release_id
  ) THEN
    RAISE EXCEPTION 'decision claim must belong to the same release'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.verdict_run_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM verdict_runs
    WHERE id = NEW.verdict_run_id AND release_id = NEW.release_id
  ) THEN
    RAISE EXCEPTION 'decision verdict run must belong to the same release'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;--> statement-breakpoint

CREATE TRIGGER decisions_same_release
BEFORE INSERT ON decisions
FOR EACH ROW EXECUTE FUNCTION release_truth_validate_decision_target();
