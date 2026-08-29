/**
 * Service configuration, read from the environment.
 *
 * Both secrets are required with no default. A development fallback here would
 * be the one that eventually ships: the service edits the live corpus and
 * triggers a real build, so "it started anyway" is the wrong failure.
 */

/** Everything `index.ts` needs to stand the service up. */
export interface AdminConfig {
  readonly host: string;
  readonly port: number;
  /** Repo root; every content path is built relative to it. */
  readonly root: string;
  readonly passwordHash: string;
  readonly sessionSecret: string;
}

export const DEFAULT_HOST = "127.0.0.1";
export const DEFAULT_PORT = 4321;
/** Shorter than this and an HMAC key is guessable rather than secret. */
export const MIN_SECRET_LENGTH = 32;

function parsePort(raw: string | undefined): number | string {
  if (raw === undefined || raw === "") {
    return DEFAULT_PORT;
  }
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return `PW_ADMIN_PORT must be a port number, got "${raw}"`;
  }
  return port;
}

/**
 * Build a config, or return the message explaining what is missing.
 *
 * Returns rather than throws so the caller decides how loudly to fail, and so
 * the whole table of failures is testable without spawning a process.
 */
export function readConfig(
  env: Readonly<Record<string, string | undefined>>,
  cwd: string,
): AdminConfig | string {
  const passwordHash = env.PW_ADMIN_PASSWORD_HASH ?? "";
  if (passwordHash === "") {
    return "PW_ADMIN_PASSWORD_HASH is not set (generate one with `node dist-admin/admin.js hash-password`)";
  }
  const sessionSecret = env.PW_ADMIN_SESSION_SECRET ?? "";
  if (sessionSecret.length < MIN_SECRET_LENGTH) {
    return `PW_ADMIN_SESSION_SECRET must be at least ${String(MIN_SECRET_LENGTH)} characters`;
  }
  const port = parsePort(env.PW_ADMIN_PORT);
  if (typeof port === "string") {
    return port;
  }
  return {
    host: env.PW_ADMIN_HOST ?? DEFAULT_HOST,
    port,
    root: env.PW_ADMIN_ROOT ?? cwd,
    passwordHash,
    sessionSecret,
  };
}
