/**
 * Password verification and session cookies, on Node built-ins only.
 *
 * `node:crypto` provides scrypt, an HMAC and a constant-time compare, so the
 * admin service needs no authentication dependency at all — which matters in a
 * repo whose gate demands every dependency sit on its newest stable release.
 *
 * Sessions are stateless: a signed `expiry.signature` cookie rather than a
 * server-side table, so restarting the container does not log you out and
 * there is no store to grow or leak.
 */

import { createHmac, randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";
import { promisify } from "node:util";
import { element } from "../../lib/captured";

/** scrypt cost parameters. N=2^15 puts one hash at roughly 100 ms. */
const SCRYPT_N = 32768;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
/**
 * scrypt needs 128 * N * r bytes -- 32 MiB at these parameters, which is
 * exactly Node's default `maxmem` and so fails with "memory limit exceeded".
 * Stated explicitly rather than by weakening N.
 */
const SCRYPT_MAXMEM = 64 * 1024 * 1024;
const KEY_BYTES = 64;
const SALT_BYTES = 16;
const PREFIX = "scrypt";

export const SESSION_COOKIE = "pw_admin_session";
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

/** scrypt cost, as a stored hash records it. */
interface Cost {
  readonly N: number;
  readonly r: number;
  readonly p: number;
}

const CURRENT_COST: Cost = { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P };

/**
 * `scrypt` as a promise.
 *
 * `promisify` rather than a hand-written wrapper: every way scrypt can fail is
 * a synchronous throw from the call itself, so a hand-written callback would
 * carry an `if (error)` branch no test can reach. The cast picks one of
 * `scrypt`'s overloads, which `promisify` cannot infer.
 */
const deriveKey = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
) => Promise<Buffer>;

function derive(password: string, salt: Buffer, cost: Cost): Promise<Buffer> {
  return deriveKey(password, salt, KEY_BYTES, { ...cost, maxmem: SCRYPT_MAXMEM });
}

/**
 * Compare two strings without leaking their contents through timing.
 *
 * `timingSafeEqual` throws on a length mismatch, which would itself be a
 * timing signal, so unequal lengths are compared against a fixed-size buffer
 * and always answer false.
 */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) {
    timingSafeEqual(left, left);
    return false;
  }
  return timingSafeEqual(left, right);
}

/** Hash a password into the storable `scrypt$N$r$p$salt$key` form. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await derive(password, salt, CURRENT_COST);
  return [
    PREFIX,
    String(SCRYPT_N),
    String(SCRYPT_R),
    String(SCRYPT_P),
    salt.toString("hex"),
    key.toString("hex"),
  ].join("$");
}

/** A positive integer, or NaN if `raw` is not one. */
function positiveInt(raw: string): number {
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : Number.NaN;
}

/**
 * True if `password` matches a hash produced by {@link hashPassword}.
 *
 * The cost comes from the *stored* hash rather than from the constants above,
 * which is the reason those three numbers are written into the string at all:
 * raising the cost later must not invalidate every existing password.
 *
 * Every way of being malformed answers false rather than throwing. A hash this
 * process cannot evaluate -- unparseable, or a cost over `maxmem` -- is an
 * operator error, and the one thing it must never do is authenticate.
 */
export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.trim().split("$");
  if (parts.length !== 6 || parts[0] !== PREFIX) {
    return false;
  }
  const cost: Cost = {
    N: positiveInt(element(parts, 1)),
    r: positiveInt(element(parts, 2)),
    p: positiveInt(element(parts, 3)),
  };
  const salt = Buffer.from(element(parts, 4), "hex");
  if (salt.length === 0 || Number.isNaN(cost.N + cost.r + cost.p)) {
    return false;
  }
  try {
    const key = await derive(password, salt, cost);
    return safeEqual(key.toString("hex"), element(parts, 5));
  } catch {
    return false;
  }
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

/** A signed session cookie value that expires `ttlMs` after `now`. */
export function createSession(
  secret: string,
  now: number,
  ttlMs: number = SESSION_TTL_MS,
): string {
  const expiresAt = String(now + ttlMs);
  return `${expiresAt}.${sign(expiresAt, secret)}`;
}

/** True if `value` is a session this secret issued and it has not expired. */
export function verifySession(
  value: string | undefined,
  secret: string,
  now: number,
): boolean {
  if (value === undefined) {
    return false;
  }
  const dot = value.indexOf(".");
  if (dot === -1) {
    return false;
  }
  const expiresAt = value.slice(0, dot);
  if (!/^\d+$/.test(expiresAt)) {
    return false;
  }
  // Signature first: an expiry check that short-circuits before verifying
  // would let an attacker probe expiry values without a valid signature.
  if (!safeEqual(value.slice(dot + 1), sign(expiresAt, secret))) {
    return false;
  }
  return Number(expiresAt) > now;
}

/** The `Set-Cookie` header for a session, or for clearing one. */
export function sessionCookieHeader(value: string | null): string {
  const attributes = "Path=/; HttpOnly; Secure; SameSite=Strict";
  return value === null
    ? `${SESSION_COOKIE}=; ${attributes}; Max-Age=0`
    : `${SESSION_COOKIE}=${value}; ${attributes}; Max-Age=${String(SESSION_TTL_MS / 1000)}`;
}

/** Parse a `Cookie` header into a map. Malformed pairs are ignored. */
export function parseCookies(header: string | undefined): Map<string, string> {
  const cookies = new Map<string, string>();
  if (header === undefined) {
    return cookies;
  }
  for (const part of header.split(";")) {
    const equals = part.indexOf("=");
    if (equals === -1) {
      continue;
    }
    cookies.set(part.slice(0, equals).trim(), part.slice(equals + 1).trim());
  }
  return cookies;
}
