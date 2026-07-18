import { createHash } from "node:crypto";

import { canonicalJson } from "../lib/canonical-json.js";

export function contentHash(payload) {
  return createHash("sha256").update(canonicalJson(payload)).digest("hex");
}

export function activeAppendOnlyRecords(records) {
  const supersededIds = new Set(
    records.map((record) => record.supersedesId).filter(Boolean),
  );
  return records.filter(
    (record) =>
      !supersededIds.has(record.id) && record.recordAction !== "revocation",
  );
}

export function validateAppendOnlyChain(records) {
  const byId = new Map(records.map((record) => [record.id, record]));
  for (const record of records) {
    if (record.recordAction === "snapshot" && record.supersedesId) return false;
    if (record.recordAction !== "snapshot" && !record.supersedesId) return false;
    if (record.supersedesId && !byId.has(record.supersedesId)) return false;
    const visited = new Set([record.id]);
    let cursor = record;
    while (cursor.supersedesId) {
      if (visited.has(cursor.supersedesId)) return false;
      visited.add(cursor.supersedesId);
      cursor = byId.get(cursor.supersedesId);
      if (!cursor) return false;
    }
  }
  return true;
}

