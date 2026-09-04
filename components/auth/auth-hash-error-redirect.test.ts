import { describe, expect, it } from "vitest";
import { hasAuthHashError } from "@/components/auth/auth-hash-error-redirect";

describe("hasAuthHashError", () => {
  it("detects the real, live-confirmed shape Supabase produces for an expired/reused magic link", () => {
    expect(
      hasAuthHashError("#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired&sb="),
    ).toBe(true);
  });

  it("returns false for an empty hash - the normal case for every other page load", () => {
    expect(hasAuthHashError("")).toBe(false);
  });

  it("returns false for a hash with no error param", () => {
    expect(hasAuthHashError("#some-other-fragment")).toBe(false);
  });

  it("works whether or not the leading # is included", () => {
    expect(hasAuthHashError("error=access_denied")).toBe(true);
  });
});
