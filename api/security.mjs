import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

const SECURE_SESSION_COOKIE = "__Host-release_truth_session";
const LOCAL_SESSION_COOKIE = "release_truth_session";
const SESSION_TTL_SECONDS = 8 * 60 * 60;
const rateBuckets =
  globalThis.__releaseTruthRateBuckets ||
  (globalThis.__releaseTruthRateBuckets = new Map());

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

function isSecureApplicationOrigin(value) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" ||
      (url.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
    );
  } catch {
    return false;
  }
}

function sessionConfig() {
  const accessCode = process.env.RELEASE_TRUTH_ACCESS_CODE;
  const sessionSecret = process.env.RELEASE_TRUTH_SESSION_SECRET;
  const isProduction = process.env.NODE_ENV === "production";
  const appOrigin = process.env.APP_ORIGIN;

  if (!accessCode && !sessionSecret && !isProduction) {
    return {
      enabled: true,
      required: false,
      actor: process.env.RELEASE_TRUTH_REVIEWER_NAME || "Local reviewer",
    };
  }

  if (
    !accessCode ||
    !sessionSecret ||
    sessionSecret.length < 32 ||
    (isProduction && !isSecureApplicationOrigin(appOrigin))
  ) {
    return {
      enabled: false,
      required: true,
      actor: "Authenticated reviewer",
    };
  }

  return {
    enabled: true,
    required: true,
    accessCode,
    sessionSecret,
    actor: process.env.RELEASE_TRUTH_REVIEWER_NAME || "Authenticated reviewer",
  };
}

function usesSecureSessionCookie() {
  if (process.env.NODE_ENV !== "production") return false;
  try {
    return new URL(process.env.APP_ORIGIN).protocol === "https:";
  } catch {
    return true;
  }
}

function sessionCookieName() {
  return usesSecureSessionCookie()
    ? SECURE_SESSION_COOKIE
    : LOCAL_SESSION_COOKIE;
}

export function getAnalystAccessState(request) {
  const config = sessionConfig();
  return {
    enabled: config.enabled,
    required: config.required,
    authenticated:
      config.enabled &&
      (!config.required || verifySessionCookie(request, config.sessionSecret)),
    actor: config.actor,
  };
}

function createSessionToken(secret) {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = `${expiresAt}.${randomBytes(16).toString("base64url")}`;
  const signature = createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");
  return `${payload}.${signature}`;
}

function parseCookies(header) {
  return Object.fromEntries(
    String(header || "")
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        return index === -1
          ? [part, ""]
          : [part.slice(0, index), part.slice(index + 1)];
      }),
  );
}

function verifySessionCookie(request, secret) {
  if (!secret) return false;
  const token =
    parseCookies(request.headers.get("cookie"))[sessionCookieName()];
  if (!token) return false;
  const [expiresAt, nonce, signature] = token.split(".");
  if (!expiresAt || !nonce || !signature) return false;
  if (!Number.isFinite(Number(expiresAt)) || Number(expiresAt) <= Date.now() / 1000) {
    return false;
  }
  const payload = `${expiresAt}.${nonce}`;
  const expected = createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");
  return safeEqual(signature, expected);
}

export function authenticateAccessCode(code) {
  const config = sessionConfig();
  if (!config.enabled || !config.required) {
    return { ok: false, reason: "not_configured" };
  }
  if (!safeEqual(code, config.accessCode)) {
    return { ok: false, reason: "invalid" };
  }
  return {
    ok: true,
    token: createSessionToken(config.sessionSecret),
    actor: config.actor,
  };
}

export function sessionCookieHeader(token) {
  const secure = usesSecureSessionCookie() ? "; Secure" : "";
  return `${sessionCookieName()}=${token}; Path=/; Max-Age=${SESSION_TTL_SECONDS}; HttpOnly; SameSite=Strict${secure}`;
}

export function validateSameOrigin(request) {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (!origin || fetchSite === "cross-site") return false;

  const requestOrigin = new URL(request.url).origin;
  const configuredOrigin = process.env.APP_ORIGIN;
  if (configuredOrigin) {
    return origin === configuredOrigin;
  }
  const allowedOrigin = requestOrigin;
  if (origin === allowedOrigin) return true;

  const originUrl = new URL(origin);
  const requestUrl = new URL(requestOrigin);
  const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
  return (
    loopbackHosts.has(originUrl.hostname) &&
    loopbackHosts.has(requestUrl.hostname) &&
    originUrl.port === requestUrl.port &&
    originUrl.protocol === requestUrl.protocol
  );
}

function clientKey(request) {
  const cloudflareIp = request.headers.get("cf-connecting-ip");
  if (cloudflareIp) return `cf:${cloudflareIp}`;
  if (process.env.NODE_ENV !== "production") {
    return "local-development-client";
  }

  const fingerprint = createHash("sha256")
    .update(
      [
        new URL(request.url).origin,
        request.headers.get("user-agent") || "unknown-agent",
        request.headers.get("accept-language") || "unknown-language",
      ].join("\n"),
    )
    .digest("base64url")
    .slice(0, 32);
  return `fallback:${fingerprint}`;
}

export function consumeRateLimit(
  request,
  { bucket, limit, windowMs = 10 * 60 * 1000 },
) {
  if (process.env.RELEASE_TRUTH_DISABLE_RATE_LIMIT === "1") {
    return { allowed: true, remaining: limit, retryAfterSeconds: 0 };
  }
  const now = Date.now();
  const key = `${bucket}:${clientKey(request)}`;
  const previous = rateBuckets.get(key) || [];
  const active = previous.filter((timestamp) => now - timestamp < windowMs);

  if (active.length >= limit) {
    const retryAfterMs = windowMs - (now - active[0]);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
    };
  }

  active.push(now);
  rateBuckets.set(key, active);

  if (rateBuckets.size > 2_000) {
    for (const [storedKey, timestamps] of rateBuckets) {
      if (timestamps.every((timestamp) => now - timestamp >= windowMs)) {
        rateBuckets.delete(storedKey);
      }
    }
  }

  return {
    allowed: true,
    remaining: Math.max(0, limit - active.length),
    retryAfterSeconds: 0,
  };
}

export async function readBoundedText(request, maxBytes) {
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    const error = new Error("Request body is too large.");
    error.code = "BODY_TOO_LARGE";
    throw error;
  }

  if (!request.body) return "";
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let text = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      const error = new Error("Request body is too large.");
      error.code = "BODY_TOO_LARGE";
      throw error;
    }
    text += decoder.decode(value, { stream: true });
  }

  return text + decoder.decode();
}

export function jsonResponse(body, init = {}) {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "no-store, private");
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("X-Content-Type-Options", "nosniff");
  return new Response(JSON.stringify(body), { ...init, headers });
}
