import {
  createHash,
  pbkdf2Sync,
  randomBytes,
} from "node:crypto";

import pg from "pg";

import {
  claims as demoClaims,
  evidenceSources as demoEvidence,
  initialDecisions as demoDecisions,
  release as demoRelease,
} from "../../src/data.js";
import { canonicalJson } from "../../src/lib/canonical-json.js";

const connectionString =
  process.env.DATABASE_URL_DIRECT ||
  process.env.DATABASE_URL ||
  "postgresql://release_truth:release_truth_local@127.0.0.1:54329/release_truth";

if (
  process.env.NODE_ENV === "production" &&
  process.env.ALLOW_NOVA_SEED !== "true"
) {
  throw new Error(
    "Nova seed is disabled in production. Set ALLOW_NOVA_SEED=true explicitly for a disposable demo workspace.",
  );
}

const seedPassword =
  process.env.NOVA_SEED_PASSWORD || "nova-demo-local-only-change-me";
const iterations = 310_000;

function uuidFromSeed(value) {
  const bytes = createHash("sha256").update(`release-truth:${value}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function sha256(value) {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

const ids = {
  user: uuidFromSeed("nova:user:jordan"),
  workspace: uuidFromSeed("nova:workspace"),
  project: uuidFromSeed("nova:project"),
  release: uuidFromSeed("nova:release:2.4"),
};

const claimIds = new Map(
  demoClaims.map((claim) => [claim.id, uuidFromSeed(`nova:claim:${claim.id}`)]),
);
const evidenceIds = new Map(
  demoEvidence.map((item) => [
    item.id,
    uuidFromSeed(`nova:evidence:${item.id}`),
  ]),
);

const client = new pg.Client({ connectionString });
await client.connect();

try {
  await client.query("BEGIN");

  const salt = randomBytes(16);
  const passwordHash = pbkdf2Sync(
    seedPassword,
    salt,
    iterations,
    32,
    "sha256",
  ).toString("base64url");

  await client.query(
    `INSERT INTO users (
      id, email, display_name, password_hash, password_salt, password_iterations,
      email_verified_at
    ) VALUES ($1, $2, $3, $4, $5, $6, now())
    ON CONFLICT (id) DO NOTHING`,
    [
      ids.user,
      "jordan@nova-demo.local",
      "Jordan Lee",
      passwordHash,
      salt.toString("base64url"),
      iterations,
    ],
  );
  await client.query(
    `INSERT INTO workspaces (id, name, slug, created_by)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (id) DO NOTHING`,
    [ids.workspace, "Nova demo", "nova-demo", ids.user],
  );
  await client.query(
    `INSERT INTO memberships (workspace_id, user_id, role)
     VALUES ($1, $2, 'owner')
     ON CONFLICT (workspace_id, user_id) DO NOTHING`,
    [ids.workspace, ids.user],
  );
  await client.query(
    `INSERT INTO projects (id, workspace_id, name, description, created_by)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (id) DO NOTHING`,
    [
      ids.project,
      ids.workspace,
      "Nova",
      "Explicit synthetic seed for demonstrating evidence-gated releases.",
      ids.user,
    ],
  );
  await client.query(
    `INSERT INTO releases (
      id, project_id, name, description, status, target_type, target_value,
      created_by, created_at
    ) VALUES ($1, $2, $3, $4, 'in_review', 'commit', $5, $6, $7)
    ON CONFLICT (id) DO NOTHING`,
    [
      ids.release,
      ids.project,
      "Nova 2.4",
      "Synthetic privacy-boundary conflict. Not production data.",
      "b7e6c3d",
      ids.user,
      new Date("2026-07-14T10:12:00Z"),
    ],
  );

  for (const claim of demoClaims) {
    const payload = {
      ...claim,
      demo: true,
      dataset: demoRelease.datasetLabel,
    };
    await client.query(
      `INSERT INTO claims (
        id, release_id, source_type, title, description, acceptance_criteria,
        source_reference, payload_snapshot, material, required_evidence_kinds,
        content_hash, authored_by, captured_at, created_at
      ) VALUES (
        $1, $2, 'manual', $3, $4, $5, $6, $7::jsonb, $8, $9::jsonb,
        $10, $11, $12, $12
      )
      ON CONFLICT (id) DO NOTHING`,
      [
        claimIds.get(claim.id),
        ids.release,
        claim.title,
        claim.text,
        claim.text,
        `synthetic:${claim.currentRevision}`,
        JSON.stringify(payload),
        claim.material,
        JSON.stringify(claim.requiredEvidenceKinds),
        sha256(payload),
        ids.user,
        new Date(claim.updatedAt),
      ],
    );
  }

  for (const item of demoEvidence) {
    const payload = {
      ...item,
      demo: true,
      dataset: demoRelease.datasetLabel,
    };
    await client.query(
      `INSERT INTO evidence (
        id, release_id, source_type, external_reference, payload_snapshot,
        summary, author_name, source_metadata, relation, evidence_kind,
        content_hash, captured_at, authored_by, created_at
      ) VALUES (
        $1, $2, 'manual', $3, $4::jsonb, $5, $6, $7::jsonb, $8, $9,
        $10, $11, $12, $11
      )
      ON CONFLICT (id) DO NOTHING`,
      [
        evidenceIds.get(item.id),
        ids.release,
        item.id,
        JSON.stringify(payload),
        item.title,
        "Synthetic Nova seed",
        JSON.stringify({
          path: item.path,
          revision: item.revision,
          confidence: item.confidence,
          demo: true,
        }),
        item.relation,
        item.kind,
        sha256(payload),
        new Date(item.updatedAt),
        ids.user,
      ],
    );
    await client.query(
      `INSERT INTO claim_evidence_links (claim_id, evidence_id, linked_by)
       VALUES ($1, $2, $3)
       ON CONFLICT (claim_id, evidence_id) DO NOTHING`,
      [claimIds.get(item.claimId), evidenceIds.get(item.id), ids.user],
    );
  }

  const scopedDecision = demoDecisions.find(
    (decision) => decision.id === "privacy-approval-jul-16",
  );
  const decisionPayload = {
    ...scopedDecision,
    demo: true,
    evidenceIds: scopedDecision.basedOnEvidenceIds.map((id) => evidenceIds.get(id)),
  };
  await client.query(
    `INSERT INTO decisions (
      id, release_id, claim_id, type, status, rationale, role_at_decision,
      based_on_evidence_ids, content_hash, authored_by, created_at
    ) VALUES (
      $1, $2, $3, 'approval', 'approved', $4, 'owner', $5::jsonb,
      $6, $7, $8
    )
    ON CONFLICT (id) DO NOTHING`,
    [
      uuidFromSeed(`nova:decision:${scopedDecision.id}`),
      ids.release,
      claimIds.get(scopedDecision.claimId),
      scopedDecision.reason,
      JSON.stringify(decisionPayload.evidenceIds),
      sha256(decisionPayload),
      ids.user,
      new Date(scopedDecision.createdAt),
    ],
  );

  await client.query("COMMIT");
  console.log(
    JSON.stringify({
      seeded: true,
      workspaceSlug: "nova-demo",
      releaseId: ids.release,
      loginEmail: "jordan@nova-demo.local",
      localDefaultPasswordUsed: !process.env.NOVA_SEED_PASSWORD,
    }),
  );
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  await client.end();
}

