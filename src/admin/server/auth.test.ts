// @vitest-environment node
import { describe, it, expect } from "vitest";
import { scrypt } from "node:crypto";
import {
  SESSION_COOKIE,
  SESSION_TTL_MS,
  createSession,
  hashPassword,
  parseCookies,
  safeEqual,
  sessionCookieHeader,
  verifyPassword,
  verifySession,
} from "./auth";

const SECRET = "a-test-session-secret";
const NOW = 1_700_000_000_000;

describe("safeEqual", () => {
  it("is true only for identical strings", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
  });

  it("answers false for different lengths without throwing", () => {
    // timingSafeEqual throws on a length mismatch, which would itself leak.
    expect(safeEqual("abc", "abcd")).toBe(false);
    expect(safeEqual("", "x")).toBe(false);
  });
});

describe("password hashing", () => {
  it("accepts the right password and rejects a wrong one", async () => {
    const stored = await hashPassword("correct horse battery staple");
    expect(await verifyPassword("correct horse battery staple", stored)).toBe(true);
    expect(await verifyPassword("Correct horse battery staple", stored)).toBe(false);
    expect(await verifyPassword("", stored)).toBe(false);
  });

  it("salts, so the same password hashes differently every time", async () => {
    expect(await hashPassword("same")).not.toBe(await hashPassword("same"));
  });

  it("records the scrypt parameters in the stored form", async () => {
    expect(await hashPassword("x")).toMatch(/^scrypt\$32768\$8\$1\$[0-9a-f]+\$[0-9a-f]+$/);
  });

  it("tolerates a trailing newline, as a file read would produce", async () => {
    const stored = await hashPassword("x");
    expect(await verifyPassword("x", `${stored}\n`)).toBe(true);
  });

  it.each([
    ["empty", ""],
    ["the wrong shape", "not-a-hash"],
    ["a foreign algorithm", "bcrypt$32768$8$1$aa$bb"],
    ["too few fields", "scrypt$32768$8$1$aa"],
    ["a non-hex salt", "scrypt$32768$8$1$zz$bb"],
  ])("rejects a stored value that is %s", async (_label, stored) => {
    expect(await verifyPassword("x", stored)).toBe(false);
  });
});

describe("sessions", () => {
  it("accepts a session it just issued", () => {
    expect(verifySession(createSession(SECRET, NOW), SECRET, NOW)).toBe(true);
  });

  it("rejects one signed with a different secret", () => {
    expect(verifySession(createSession("other", NOW), SECRET, NOW)).toBe(false);
  });

  it("rejects one whose expiry has passed", () => {
    const session = createSession(SECRET, NOW, 1000);
    expect(verifySession(session, SECRET, NOW + 999)).toBe(true);
    expect(verifySession(session, SECRET, NOW + 1001)).toBe(false);
  });

  it("rejects a tampered expiry, since the signature covers it", () => {
    const session = createSession(SECRET, NOW);
    const signature = session.slice(session.indexOf(".") + 1);
    expect(verifySession(`${String(NOW + 1e12)}.${signature}`, SECRET, NOW)).toBe(false);
  });

  it.each([
    ["absent", undefined],
    ["empty", ""],
    ["missing a separator", "abcdef"],
    ["a non-numeric expiry", "abc.def"],
  ])("rejects a cookie that is %s", (_label, value) => {
    expect(verifySession(value, SECRET, NOW)).toBe(false);
  });
});

describe("sessionCookieHeader", () => {
  it("sets the hardening attributes", () => {
    const header = sessionCookieHeader("v");
    expect(header).toContain(`${SESSION_COOKIE}=v`);
    expect(header).toContain("HttpOnly");
    expect(header).toContain("Secure");
    expect(header).toContain("SameSite=Strict");
    expect(header).toContain(`Max-Age=${String(SESSION_TTL_MS / 1000)}`);
  });

  it("expires the cookie when clearing", () => {
    expect(sessionCookieHeader(null)).toContain("Max-Age=0");
  });
});

describe("parseCookies", () => {
  it("reads a normal header", () => {
    const cookies = parseCookies("a=1; b=2");
    expect(cookies.get("a")).toBe("1");
    expect(cookies.get("b")).toBe("2");
  });

  it("keeps values containing an equals sign intact", () => {
    expect(parseCookies("a=x=y").get("a")).toBe("x=y");
  });

  it("ignores malformed pairs and an absent header", () => {
    expect(parseCookies("novalue; a=1").get("a")).toBe("1");
    expect(parseCookies("novalue").size).toBe(0);
    expect(parseCookies(undefined).size).toBe(0);
  });
});

describe("verifyPassword against a stored cost", () => {
  it("still verifies a hash written at a lower cost than the current one", async () => {
    // The three numbers in the stored string are there to be honoured: raising
    // SCRYPT_N later must not lock the author out of their own site.
    const cheap = (await hashPassword("hunter2")).split("$");
    const key = await new Promise<string>((resolve, reject) => {
      scrypt(
        "hunter2",
        Buffer.from(cheap[4] ?? "", "hex"),
        64,
        { N: 16384, r: 8, p: 1 },
        (error, derived) => {
          if (error) {
            reject(error);
            return;
          }
          resolve(derived.toString("hex"));
        },
      );
    });
    const stored = ["scrypt", "16384", "8", "1", cheap[4], key].join("$");
    expect(await verifyPassword("hunter2", stored)).toBe(true);
    expect(await verifyPassword("wrong", stored)).toBe(false);
  });

  it.each([
    ["scrypt$notanumber$8$1$aabb$cc", "an unparseable cost"],
    ["scrypt$32768$0$1$aabb$cc", "a zero parameter"],
    ["scrypt$-1$8$1$aabb$cc", "a negative parameter"],
  ])("refuses %s (%s) rather than throwing", async (stored) => {
    expect(await verifyPassword("hunter2", stored)).toBe(false);
  });

  it("refuses a cost this process cannot allocate, instead of crashing", async () => {
    // N far past maxmem: scrypt reports "memory limit exceeded" through its
    // callback, which must read as "no" rather than as an unhandled rejection.
    const stored = `scrypt$${String(2 ** 24)}$8$1$aabb$cc`;
    expect(await verifyPassword("hunter2", stored)).toBe(false);
  });
});
