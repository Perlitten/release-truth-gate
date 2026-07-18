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

