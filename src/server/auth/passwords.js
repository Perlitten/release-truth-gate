import {
  pbkdf2 as pbkdf2Callback,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";

const pbkdf2 = promisify(pbkdf2Callback);

export const PASSWORD_ITERATIONS = 310_000;
const PASSWORD_BYTES = 32;

export function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

export async function derivePassword(
  password,
  {
    salt = randomBytes(16).toString("base64url"),
    iterations = PASSWORD_ITERATIONS,
  } = {},
) {
  const derived = await pbkdf2(
    password,
    Buffer.from(salt, "base64url"),
    iterations,
    PASSWORD_BYTES,
    "sha256",
  );
  return {
    hash: derived.toString("base64url"),
    salt,
    iterations,
  };
}

export async function verifyPassword(password, stored) {
  const candidate = await derivePassword(password, {
    salt: stored.salt,
    iterations: stored.iterations,
  });
  const left = Buffer.from(candidate.hash, "base64url");
  const right = Buffer.from(stored.hash, "base64url");
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function consumeDummyPasswordWork(password) {
  await derivePassword(password, {
    salt: "cmVsZWFzZS10cnV0aC1kdW1teQ",
    iterations: PASSWORD_ITERATIONS,
  });
}

