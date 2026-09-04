import { afterEach, describe, expect, it } from "vitest";
import { assertOutboundMessageAllowed, isProductionEnvironment } from "./staging-guard";

afterEach(() => {
  delete process.env.APP_ENV;
  delete process.env.STAGING_MESSAGE_ALLOWLIST;
});

describe("isProductionEnvironment", () => {
  it("is false when APP_ENV is unset", () => {
    expect(isProductionEnvironment()).toBe(false);
  });

  it("is false for any value other than exactly 'production'", () => {
    process.env.APP_ENV = "staging";
    expect(isProductionEnvironment()).toBe(false);
  });

  it("is true only for 'production'", () => {
    process.env.APP_ENV = "production";
    expect(isProductionEnvironment()).toBe(true);
  });
});

describe("assertOutboundMessageAllowed", () => {
  it("allows any recipient in production", () => {
    process.env.APP_ENV = "production";
    expect(() => assertOutboundMessageAllowed("anyone@example.com")).not.toThrow();
  });

  it("blocks a non-allowlisted recipient outside production", () => {
    expect(() => assertOutboundMessageAllowed("caregiver@example.com")).toThrow(
      /Blocked outbound message/,
    );
  });

  it("allows a recipient on the staging allowlist, case-insensitively", () => {
    process.env.STAGING_MESSAGE_ALLOWLIST = "Team@Example.com, other@example.com";
    expect(() => assertOutboundMessageAllowed("team@example.com")).not.toThrow();
  });

  it("blocks when the allowlist is unset", () => {
    process.env.STAGING_MESSAGE_ALLOWLIST = "";
    expect(() => assertOutboundMessageAllowed("team@example.com")).toThrow();
  });

  it("allows any recipient at a domain given as a leading-@ allowlist entry", () => {
    process.env.STAGING_MESSAGE_ALLOWLIST = "@example.com";
    expect(() => assertOutboundMessageAllowed("e2e-admin-1234-abcd@example.com")).not.toThrow();
    expect(() => assertOutboundMessageAllowed("anyone-else@example.com")).not.toThrow();
  });

  it("a domain allowlist entry does not match a different domain", () => {
    process.env.STAGING_MESSAGE_ALLOWLIST = "@example.com";
    expect(() => assertOutboundMessageAllowed("caregiver@gmail.com")).toThrow(/Blocked outbound message/);
  });

  it("a domain allowlist entry does not match a lookalike domain sharing only a suffix", () => {
    process.env.STAGING_MESSAGE_ALLOWLIST = "@example.com";
    expect(() => assertOutboundMessageAllowed("caregiver@notexample.com")).toThrow(/Blocked outbound message/);
  });
});
