// @vitest-environment node
import { describe, it, expect } from "vitest";
import { DEFAULT_HOST, DEFAULT_PORT, MIN_SECRET_LENGTH, readConfig } from "./config";

const SECRET = "s".repeat(MIN_SECRET_LENGTH);
const HASH = "scrypt$32768$8$1$aa$bb";

const env = (extra: Record<string, string | undefined> = {}) => ({
  PW_ADMIN_PASSWORD_HASH: HASH,
  PW_ADMIN_SESSION_SECRET: SECRET,
  ...extra,
});

describe("readConfig", () => {
  it("fills in the loopback defaults", () => {
    expect(readConfig(env(), "/repo")).toEqual({
      host: DEFAULT_HOST,
      port: DEFAULT_PORT,
      root: "/repo",
      passwordHash: HASH,
      sessionSecret: SECRET,
    });
  });

  it("takes host, port and root from the environment", () => {
    const config = readConfig(
      env({ PW_ADMIN_HOST: "::1", PW_ADMIN_PORT: "9000", PW_ADMIN_ROOT: "/srv/site" }),
      "/repo",
    );
    expect(config).toMatchObject({ host: "::1", port: 9000, root: "/srv/site" });
  });

  it("treats an empty port as unset rather than as an error", () => {
    expect(readConfig(env({ PW_ADMIN_PORT: "" }), "/repo")).toMatchObject({ port: DEFAULT_PORT });
  });

  it.each([
    [{ PW_ADMIN_PASSWORD_HASH: undefined }, /PW_ADMIN_PASSWORD_HASH/],
    [{ PW_ADMIN_PASSWORD_HASH: "" }, /PW_ADMIN_PASSWORD_HASH/],
    [{ PW_ADMIN_SESSION_SECRET: undefined }, /at least 32/],
    [{ PW_ADMIN_SESSION_SECRET: "short" }, /at least 32/],
    [{ PW_ADMIN_PORT: "0" }, /must be a port number/],
    [{ PW_ADMIN_PORT: "70000" }, /must be a port number/],
    [{ PW_ADMIN_PORT: "8080.5" }, /must be a port number/],
    [{ PW_ADMIN_PORT: "http" }, /must be a port number/],
  ])("refuses %j", (extra, expected) => {
    const result = readConfig(env(extra), "/repo");
    expect(typeof result).toBe("string");
    expect(result).toMatch(expected);
  });
});
