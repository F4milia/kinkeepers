import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * F3's own acceptance criterion ("grep confirms no per-member notes
 * field exists") as a permanent, automated check instead of a one-time
 * manual command - a manual grep proves the invariant held on the day
 * someone ran it, not that it still holds after the next migration.
 * CLAUDE.md is explicit that the roster/prep view exposes attendance as
 * a real aggregate count, never free text about a specific person - this
 * fails the build the moment any table shaped "one row per member" (a
 * column referencing applicants(id), the only per-member identity this
 * schema has) also carries a free-text notes-like column.
 *
 * session_logs.notes (per-SESSION, keyed only on session_id, not on any
 * applicant) is the one legitimate "notes" column near this area of the
 * schema and is correctly excluded, since its own table never references
 * applicants(id) at all.
 */
const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");
const NOTES_COLUMN_PATTERN = /^\s*(notes?|comments?|observations?)\s+text\b/im;

function extractCreateTableBlocks(sql: string): { name: string; body: string }[] {
  const blocks: { name: string; body: string }[] = [];
  const startPattern = /create table\s+(?:if not exists\s+)?(\w+)\s*\(/gi;
  let match: RegExpExecArray | null;
  while ((match = startPattern.exec(sql)) !== null) {
    const bodyStart = match.index + match[0].length;
    const closeIndex = sql.indexOf("\n);", bodyStart);
    if (closeIndex === -1) continue;
    blocks.push({ name: match[1], body: sql.slice(bodyStart, closeIndex) });
  }
  return blocks;
}

describe("no per-member notes field exists anywhere in the schema (F3)", () => {
  const migrationFiles = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql"));
  expect(migrationFiles.length).toBeGreaterThan(0);

  const perMemberTablesWithNotes: string[] = [];

  for (const file of migrationFiles) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf-8");
    for (const block of extractCreateTableBlocks(sql)) {
      const isPerMember = /references\s+applicants\s*\(\s*id\s*\)/i.test(block.body);
      if (isPerMember && NOTES_COLUMN_PATTERN.test(block.body)) {
        perMemberTablesWithNotes.push(`${block.name} (${file})`);
      }
    }
  }

  it("finds zero tables shaped one-row-per-member with a free-text notes column", () => {
    expect(perMemberTablesWithNotes).toEqual([]);
  });

  // A positive control, per this session's own established pattern for
  // isolation tests (P6's lesson: an assertion that would pass identically
  // whether the real thing being tested is broken or not proves nothing).
  // Confirms the scanner itself actually finds real tables and would
  // catch a real violation, not that it silently matched nothing at all.
  it("sanity check: the scanner finds session_attendance, a real per-member table, to prove it isn't silently matching zero tables", () => {
    const sql = readFileSync(join(MIGRATIONS_DIR, "20260902110000_session_attendance.sql"), "utf-8");
    const blocks = extractCreateTableBlocks(sql);
    const sessionAttendance = blocks.find((b) => b.name === "session_attendance");
    expect(sessionAttendance).toBeDefined();
    expect(/references\s+applicants\s*\(\s*id\s*\)/i.test(sessionAttendance!.body)).toBe(true);
  });
});
