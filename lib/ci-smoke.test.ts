import { describe, expect, it } from "vitest";

// Proves the CI pipeline actually runs tests, not just that the pipeline
// exists. Delete only once a real test suite makes it redundant.
describe("CI pipeline", () => {
  it("runs vitest", () => {
    expect(1 + 1).toBe(2);
  });
});
