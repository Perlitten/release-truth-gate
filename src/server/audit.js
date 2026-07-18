import { createHash } from "node:crypto";

import { desc, eq, sql } from "drizzle-orm";

import { auditEvents, workspaces } from "../../db/schema.js";
import { canonicalJson } from "../lib/canonical-json.js";

export async function appendAuditEvent(
  tx,
  {
    workspaceId,
    actorId = null,
    actorRole = null,
    action,
    targetType,
    targetId = null,
    metadata = {},
    createdAt = new Date(),
  },
) {
  await tx
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .for("update");

  const [previous] = await tx
    .select({ eventHash: auditEvents.eventHash })
    .from(auditEvents)
    .where(eq(auditEvents.workspaceId, workspaceId))
    .orderBy(desc(auditEvents.createdAt), desc(auditEvents.id))
    .limit(1);

  const previousEventHash = previous?.eventHash || null;
  const hashInput = {
    workspaceId,
    actorId,
    actorRole,
    action,
    targetType,
    targetId,
    metadata,
    previousEventHash,
    createdAt: createdAt.toISOString(),
  };
  const eventHash = createHash("sha256")
    .update(canonicalJson(hashInput))
    .digest("hex");

  const [event] = await tx
    .insert(auditEvents)
    .values({
      workspaceId,
      actorId,
      actorRole,
      action,
      targetType,
      targetId,
      metadata,
      previousEventHash,
      eventHash,
      createdAt,
    })
    .returning();

  return event;
}

export async function verifyAuditChain(db, workspaceId) {
  const events = await db
    .select()
    .from(auditEvents)
    .where(eq(auditEvents.workspaceId, workspaceId))
    .orderBy(auditEvents.createdAt, auditEvents.id);

  let previousEventHash = null;
  for (const event of events) {
    if (event.previousEventHash !== previousEventHash) return false;
    const hashInput = {
      workspaceId: event.workspaceId,
      actorId: event.actorId,
      actorRole: event.actorRole,
      action: event.action,
      targetType: event.targetType,
      targetId: event.targetId,
      metadata: event.metadata,
      previousEventHash: event.previousEventHash,
      createdAt: event.createdAt.toISOString(),
    };
    const expected = createHash("sha256")
      .update(canonicalJson(hashInput))
      .digest("hex");
    if (event.eventHash !== expected) return false;
    previousEventHash = event.eventHash;
  }
  return true;
}

