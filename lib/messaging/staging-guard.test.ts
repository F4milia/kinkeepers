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
});
