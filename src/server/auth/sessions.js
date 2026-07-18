import { createHash, randomBytes } from "node:crypto";

import { and, eq, gt, isNull } from "drizzle-orm";

import { userSessions, users } from "../../../db/schema.js";

const SECURE_COOKIE = "__Host-release_truth_user";
const LOCAL_COOKIE = "release_truth_user";
const DEFAULT_TTL_HOURS = 24;

function secureCookiesEnabled() {
  if (process.env.NODE_ENV !== "production") return false;
  try {
    return new URL(process.env.APP_ORIGIN).protocol === "https:";
  } catch {
    return true;
  }
}

export function userSessionCookieName() {
  return secureCookiesEnabled() ? SECURE_COOKIE : LOCAL_COOKIE;
}

function parseCookies(header) {
  return Object.fromEntries(
    String(header || "")
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const separator = part.indexOf("=");
        return separator === -1
          ? [part, ""]
          : [part.slice(0, separator), part.slice(separator + 1)];
      }),
  );
}

export function hashSessionToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function sessionTtlHours() {
  const configured = Number(process.env.SESSION_TTL_HOURS);
  if (Number.isInteger(configured) && configured >= 1 && configured <= 168) {
    return configured;
  }
  return DEFAULT_TTL_HOURS;
}

export async function createUserSession(tx, userId) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + sessionTtlHours() * 60 * 60 * 1000);
  await tx.insert(userSessions).values({
    userId,
    tokenHash: hashSessionToken(token),
    expiresAt,
  });
  return { token, expiresAt };
}

export function userSessionCookieHeader({ token, expiresAt }) {
  const secure = secureCookiesEnabled() ? "; Secure" : "";
  const maxAge = Math.max(
    0,
    Math.floor((expiresAt.getTime() - Date.now()) / 1000),
  );
  return `${userSessionCookieName()}=${token}; Path=/; Max-Age=${maxAge}; Expires=${expiresAt.toUTCString()}; HttpOnly; SameSite=Strict${secure}`;
}

export function clearUserSessionCookieHeader() {
  const secure = secureCookiesEnabled() ? "; Secure" : "";
  return `${userSessionCookieName()}=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Strict${secure}`;
}

export function sessionTokenFromRequest(request) {
  return parseCookies(request.headers.get("cookie"))[userSessionCookieName()] || null;
}

export async function getUserSession(db, request) {
  const token = sessionTokenFromRequest(request);
  if (!token) return null;

  const [row] = await db
    .select({
      sessionId: userSessions.id,
      sessionExpiresAt: userSessions.expiresAt,
      userId: users.id,
      email: users.email,
      displayName: users.displayName,
    })
    .from(userSessions)
    .innerJoin(users, eq(users.id, userSessions.userId))
    .where(
      and(
        eq(userSessions.tokenHash, hashSessionToken(token)),
        isNull(userSessions.revokedAt),
        gt(userSessions.expiresAt, new Date()),
        isNull(users.disabledAt),
      ),
    )
    .limit(1);

  return row || null;
}

export async function revokeRequestSession(db, request) {
  const token = sessionTokenFromRequest(request);
  if (!token) return;
  await db
    .update(userSessions)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(userSessions.tokenHash, hashSessionToken(token)),
        isNull(userSessions.revokedAt),
      ),
    );
}

