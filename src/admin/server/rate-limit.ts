/**
 * Login attempt throttling.
 *
 * The admin surface is reachable from the LAN, Tailscale and WireGuard, so the
 * password is not the only boundary -- but it is still the last one, and an
 * unthrottled login endpoint turns a weak password into a matter of minutes.
 *
 * Deliberately keyed by nothing: there is one account, so a global counter is
 * both simpler and stricter than a per-IP one, which an attacker on a /64
 * could sidestep for free.
 */

export const MAX_ATTEMPTS = 5;
export const LOCKOUT_MS = 15 * 60 * 1000;

/** Attempt bookkeeping. Constructed per process; state lives in the instance. */
export class LoginThrottle {
  #failures = 0;
  #lockedUntil = 0;

  /** Milliseconds remaining before another attempt is allowed, else 0. */
  retryAfterMs(now: number): number {
    return this.#lockedUntil > now ? this.#lockedUntil - now : 0;
  }

  /** True if a login attempt may be made at `now`. */
  allows(now: number): boolean {
    return this.retryAfterMs(now) === 0;
  }

  /** Record a rejected password, locking out once the threshold is reached. */
  recordFailure(now: number): void {
    this.#failures += 1;
    if (this.#failures >= MAX_ATTEMPTS) {
      this.#failures = 0;
      this.#lockedUntil = now + LOCKOUT_MS;
    }
  }

  /** Clear the counter after a successful login. */
  recordSuccess(): void {
    this.#failures = 0;
    this.#lockedUntil = 0;
  }
}
