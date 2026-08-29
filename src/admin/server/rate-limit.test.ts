// @vitest-environment node
import { describe, it, expect } from "vitest";
import { LOCKOUT_MS, MAX_ATTEMPTS, LoginThrottle } from "./rate-limit";

const NOW = 1_700_000_000_000;

describe("LoginThrottle", () => {
  it("allows attempts when fresh", () => {
    const throttle = new LoginThrottle();
    expect(throttle.allows(NOW)).toBe(true);
    expect(throttle.retryAfterMs(NOW)).toBe(0);
  });

  it("tolerates one failure short of the threshold", () => {
    const throttle = new LoginThrottle();
    for (let i = 0; i < MAX_ATTEMPTS - 1; i += 1) {
      throttle.recordFailure(NOW);
    }
    expect(throttle.allows(NOW)).toBe(true);
  });

  it("locks out at the threshold and reports the wait", () => {
    const throttle = new LoginThrottle();
    for (let i = 0; i < MAX_ATTEMPTS; i += 1) {
      throttle.recordFailure(NOW);
    }
    expect(throttle.allows(NOW)).toBe(false);
    expect(throttle.retryAfterMs(NOW)).toBe(LOCKOUT_MS);
  });

  it("allows attempts again once the lockout elapses", () => {
    const throttle = new LoginThrottle();
    for (let i = 0; i < MAX_ATTEMPTS; i += 1) {
      throttle.recordFailure(NOW);
    }
    expect(throttle.allows(NOW + LOCKOUT_MS - 1)).toBe(false);
    expect(throttle.allows(NOW + LOCKOUT_MS + 1)).toBe(true);
  });

  it("clears the counter on success, so failures do not accumulate forever", () => {
    const throttle = new LoginThrottle();
    for (let i = 0; i < MAX_ATTEMPTS - 1; i += 1) {
      throttle.recordFailure(NOW);
    }
    throttle.recordSuccess();
    throttle.recordFailure(NOW);
    expect(throttle.allows(NOW)).toBe(true);
  });
});
