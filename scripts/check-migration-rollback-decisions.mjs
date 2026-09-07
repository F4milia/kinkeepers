#!/usr/bin/env node
// R1's acceptance line: "Every migration carries its rollback decision -
// grep for undecided migrations returns zero." docs/migration-rollback-decisions.md
// tracks that decision separately from the migration files themselves (see
// that file's own header for why - editing an already-applied migration
// file is a standing risk, per CLAUDE.md's Learned Constraints), which
// means nothing greppable lived inside supabase/migrations/ itself for
// this to check. This script is that grep: every filename under
// supabase/migrations/ must appear as a table row in the tracker doc, or
// this fails and names exactly which migrations are undecided.
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = path.join(repoRoot, "supabase", "migrations");
const trackerPath = path.join(repoRoot, "docs", "migration-rollback-decisions.md");

const migrationNames = readdirSync(migrationsDir)
  .filter((name) => name.endsWith(".sql"))
  .map((name) => name.replace(/\.sql$/, ""))
  .sort();

const trackerContent = readFileSync(trackerPath, "utf8");
const trackedNames = new Set(
  [...trackerContent.matchAll(/`(\d{14}_[a-z0-9_]+)`/g)].map((match) => match[1]),
);

const undecided = migrationNames.filter((name) => !trackedNames.has(name));

if (undecided.length > 0) {
  console.error(
    `${undecided.length} migration(s) have no rollback decision in ${path.relative(repoRoot, trackerPath)}:`,
  );
  for (const name of undecided) {
    console.error(`  - ${name}`);
  }
  console.error(
    "\nAdd a row to the Decisions table there before merging - see that file's own header for the two named reasoning patterns and its worked examples.",
  );
  process.exit(1);
}

console.log(`All ${migrationNames.length} migrations have a recorded rollback decision.`);
