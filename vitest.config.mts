import path from "node:path";
import { defineConfig } from "vitest/config";

// These are Supabase's standard local-dev demo keys - identical on every
// local `supabase start`, only reachable at 127.0.0.1, not a secret.
// Integration tests run against the local stack, never the hosted project.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "."),
      // The `server-only` package throws when it detects it's not running
      // inside Next's own build pipeline, which vitest isn't. Its whole
      // job is a build-time guard against client-component imports - moot
      // in a Node test runner where we're intentionally calling
      // server-side code directly, so it's a no-op here.
      "server-only": path.resolve(import.meta.dirname, "test/stubs/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["**/*.test.ts", "**/*.test.tsx"],
    exclude: ["node_modules", ".next"],
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54361",
      NEXT_PUBLIC_SUPABASE_ANON_KEY:
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0",
      SUPABASE_SERVICE_ROLE_KEY:
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU",
    },
  },
});
