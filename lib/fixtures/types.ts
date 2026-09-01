/**
 * L5: these shapes moved to lib/types.ts, which now has zero dependency
 * on anything under lib/fixtures - lib/data.ts and every real component
 * import from there instead. This file re-exports so lib/fixtures/data.ts
 * (the mock data, still used by tests) and any test file that still
 * imports types the old way both keep working unchanged.
 */
export * from "@/lib/types";
