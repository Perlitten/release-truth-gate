import { randomUUID } from "node:crypto";

import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const databaseUrl =
  process.env.DATABASE_URL_TEST ||
  "postgresql://release_truth:release_truth_local@127.0.0.1:54329/release_truth_test";

let client;
let userId;
let workspaceId;
let projectId;
let releaseId;
let otherReleaseId;
let claimId;
let evidenceId;

async function insertRelease(name) {
  const result = await client.query(
    `INSERT INTO releases (project_id, name, created_by)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [projectId, name, userId],
  );
  return result.rows[0].id;
}

beforeAll(async () => {
  client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();

  userId = randomUUID();
  workspaceId = randomUUID();
  projectId = randomUUID();

  await client.query(
    `INSERT INTO users (
      id, email, display_name, password_hash, password_salt, password_iterations
    ) VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, "db-test@example.test", "DB Test", "hash", "salt", 100_000],
  );
  await client.query(
    `INSERT INTO workspaces (id, name, slug, created_by)
     VALUES ($1, $2, $3, $4)`,
    [workspaceId, "DB Test Workspace", "db-test-workspace", userId],
  );
  await client.query(
    `INSERT INTO memberships (workspace_id, user_id, role)
     VALUES ($1, $2, 'owner')`,
    [workspaceId, userId],
  );
  await client.query(
    `INSERT INTO projects (id, workspace_id, name, created_by)
     VALUES ($1, $2, $3, $4)`,
    [projectId, workspaceId, "DB Test Project", userId],
  );

  releaseId = await insertRelease("1.0.0");
  otherReleaseId = await insertRelease("2.0.0");

  const claim = await client.query(
    `INSERT INTO claims (
      release_id, source_type, title, description, acceptance_criteria,
      payload_snapshot, required_evidence_kinds, content_hash, authored_by
    ) VALUES ($1, 'manual', $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8)
    RETURNING id`,
    [
      releaseId,
      "Claim",
      "A material claim",
      "Current evidence exists",
      JSON.stringify({ title: "Claim" }),
      JSON.stringify(["manual"]),
      "a".repeat(64),
      userId,
    ],
  );
  claimId = claim.rows[0].id;

  const evidence = await client.query(
    `INSERT INTO evidence (
      release_id, source_type, payload_snapshot, summary, relation,
      evidence_kind, content_hash, captured_at, authored_by
    ) VALUES ($1, 'manual', $2::jsonb, $3, 'supports', 'manual', $4, now(), $5)
    RETURNING id`,
    [
      releaseId,
      JSON.stringify({ text: "Verified output" }),
      "Verified output",
      "b".repeat(64),
      userId,
    ],
  );
  evidenceId = evidence.rows[0].id;
});

afterAll(async () => {
  await client.end();
});

describe("PostgreSQL MVP foundation", () => {
  it("creates the complete schema from an empty database", async () => {
    const result = await client.query(
      `SELECT tablename
       FROM pg_tables
       WHERE schemaname = 'public'
       ORDER BY tablename`,
    );
    expect(result.rows.map((row) => row.tablename)).toEqual(
      expect.arrayContaining([
        "users",
        "user_sessions",
        "workspaces",
        "memberships",
        "invitations",
        "projects",
        "releases",
        "claims",
        "evidence",
        "claim_evidence_links",
        "decisions",
        "verdict_runs",
        "github_installations",
        "project_repositories",
        "integration_imports",
        "audit_events",
        "export_artifacts",
      ]),
    );
  });

  it("blocks UPDATE and DELETE for every immutable table at database level", async () => {
    const triggers = await client.query(
      `SELECT event_object_table, event_manipulation
       FROM information_schema.triggers
       WHERE trigger_name LIKE '%_immutable'
       ORDER BY event_object_table, event_manipulation`,
    );

    const protectedTables = new Set(
      triggers.rows.map((row) => row.event_object_table),
    );
    expect(protectedTables).toEqual(
      new Set([
        "audit_events",
        "claim_evidence_links",
        "claims",
        "decisions",
        "evidence",
        "export_artifacts",
        "integration_imports",
        "verdict_runs",
      ]),
    );

    await expect(
      client.query("UPDATE evidence SET summary = 'tampered' WHERE id = $1", [
        evidenceId,
      ]),
    ).rejects.toMatchObject({ code: "55000" });
    await expect(
      client.query("DELETE FROM claims WHERE id = $1", [claimId]),
    ).rejects.toMatchObject({ code: "55000" });
  });

  it("rejects cross-release claim/evidence links", async () => {
    const otherEvidence = await client.query(
      `INSERT INTO evidence (
        release_id, source_type, payload_snapshot, summary, relation,
        evidence_kind, content_hash, captured_at, authored_by
      ) VALUES ($1, 'manual', $2::jsonb, $3, 'supports', 'manual', $4, now(), $5)
      RETURNING id`,
      [
        otherReleaseId,
        JSON.stringify({ text: "Other release" }),
        "Other release evidence",
        "c".repeat(64),
        userId,
      ],
    );

    await expect(
      client.query(
        `INSERT INTO claim_evidence_links (claim_id, evidence_id, linked_by)
         VALUES ($1, $2, $3)`,
        [claimId, otherEvidence.rows[0].id, userId],
      ),
    ).rejects.toMatchObject({ code: "23514" });
  });

  it("accepts a same-release link and rejects chain parents from another release", async () => {
    await expect(
      client.query(
        `INSERT INTO claim_evidence_links (claim_id, evidence_id, linked_by)
         VALUES ($1, $2, $3)`,
        [claimId, evidenceId, userId],
      ),
    ).resolves.toMatchObject({ rowCount: 1 });

    await expect(
      client.query(
        `INSERT INTO evidence (
          release_id, source_type, payload_snapshot, summary, relation,
          evidence_kind, record_action, supersedes_id, correction_reason,
          content_hash, captured_at, authored_by
        ) VALUES (
          $1, 'manual', $2::jsonb, $3, 'supports', 'manual', 'correction',
          $4, $5, $6, now(), $7
        )`,
        [
          otherReleaseId,
          JSON.stringify({ text: "Invalid correction" }),
          "Invalid correction",
          evidenceId,
          "Wrong release parent",
          "d".repeat(64),
          userId,
        ],
      ),
    ).rejects.toMatchObject({ code: "23514" });
  });

  it("deduplicates identical verdict inputs for one engine version", async () => {
    const digest = "e".repeat(64);
    await expect(
      client.query(
        `INSERT INTO verdict_runs (
          release_id, engine_version, policy_version, input_snapshot,
          input_digest, result, reason_codes, initiated_by
        ) VALUES ($1, '1.0.0', '1', $2::jsonb, $3, $4::jsonb, $5::jsonb, $6)`,
        [
          releaseId,
          JSON.stringify({ claims: [claimId], evidence: [evidenceId] }),
          digest,
          JSON.stringify({ status: "go" }),
          JSON.stringify([]),
          userId,
        ],
      ),
    ).resolves.toMatchObject({ rowCount: 1 });

    await expect(
      client.query(
        `INSERT INTO verdict_runs (
          release_id, engine_version, policy_version, input_snapshot,
          input_digest, result, reason_codes, initiated_by
        ) VALUES ($1, '1.0.0', '1', $2::jsonb, $3, $4::jsonb, $5::jsonb, $6)`,
        [
          releaseId,
          JSON.stringify({ claims: [claimId], evidence: [evidenceId] }),
          digest,
          JSON.stringify({ status: "go" }),
          JSON.stringify([]),
          userId,
        ],
      ),
    ).rejects.toMatchObject({ code: "23505" });
  });
});

