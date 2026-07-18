import { z } from "zod";

export const SNAPSHOT_VERSION = 1;
export const LOCAL_DRAFT_KEY = "release-truth:nova-2.4:draft:v1";

const decisionSchema = z.object({
  id: z.string().min(1).max(120),
  type: z.enum(["supersession_proposal", "risk_waiver_request"]),
  claimId: z.string().min(1).max(120),
  issueId: z.string().min(1).max(160),
  status: z.literal("pending"),
  actor: z.string().min(2).max(120),
  reason: z.string().min(12).max(800),
  createdAt: z.iso.datetime(),
  expiresAt: z.iso.datetime().nullable(),
  evidenceHead: z.string().min(1).max(160),
  basedOnEvidenceIds: z.array(z.string().min(1).max(120)).max(20),
});

const citationSchema = z.object({
  sourceId: z.string().min(1).max(80),
  relation: z.enum(["supports", "contradicts", "supersedes", "missing"]),
  excerpt: z.string().min(3).max(260),
});

const assessmentSchema = z.object({
  assessment: z.object({
    relation: z.enum(["supports", "contradicts", "unproven"]),
    headline: z.string().min(1).max(140),
    finding: z.string().min(1).max(700),
    impact: z.string().min(1).max(500),
    confidence: z.number().min(0).max(1),
    invalidatesDecision: z.string().max(160).nullable(),
    evidence: z.array(citationSchema).max(8),
    missingEvidence: z.array(z.string().max(180)).max(5),
    recommendedAction: z.string().min(1).max(240),
  }),
  mode: z.literal("live"),
  model: z.string().min(1).max(120),
  responseId: z.string().min(1).max(160),
  analyzedAt: z.iso.datetime(),
  evidenceHead: z.string().min(1).max(160),
});

export const portableStateSchema = z.object({
  version: z.literal(SNAPSHOT_VERSION),
  releaseId: z.literal("nova-2.4"),
  evidenceHead: z.string().min(1).max(160),
  decisions: z.array(decisionSchema).max(100),
  assessments: z.record(z.string(), assessmentSchema),
  savedAt: z.iso.datetime(),
});

export function sanitizePortableState(value) {
  const parsed = portableStateSchema.parse(value);
  return {
    ...parsed,
    assessments: {},
  };
}

function encodeBase64Url(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function decodeBase64Url(value) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function serializePortableState(state) {
  const parsed = sanitizePortableState(state);
  return encodeBase64Url(JSON.stringify(parsed));
}

export function parsePortableState(encoded) {
  if (typeof encoded !== "string" || encoded.length > 48_000) return null;
  try {
    return sanitizePortableState(JSON.parse(decodeBase64Url(encoded)));
  } catch {
    return null;
  }
}

export function stateFromLocationHash(hash) {
  if (typeof hash !== "string") return null;
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const encoded = params.get("snapshot");
  return encoded ? parsePortableState(encoded) : null;
}

export function buildShareUrl(currentUrl, state) {
  const url = new URL(currentUrl);
  url.hash = new URLSearchParams({
    snapshot: serializePortableState(state),
  }).toString();
  return url.toString();
}

function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, sortValue(value[key])]),
    );
  }
  return value;
}

export function canonicalJson(value) {
  return JSON.stringify(sortValue(value));
}

export async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export async function createEvidenceExport(bundle) {
  const unsigned = {
    format: "release-truth-evidence-bundle",
    formatVersion: 1,
    ...bundle,
  };
  const digest = await sha256(canonicalJson(unsigned));
  return {
    ...unsigned,
    integrity: {
      algorithm: "SHA-256",
      digest,
      note:
        "Checksum detects accidental changes; this demo export is not server-signed or tamper-proof.",
    },
  };
}
