import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { inngest } from "@/lib/inngest/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifySessionReminder, notifyMissedSession } from "@/lib/messaging/session-notifications";
import { log } from "@/lib/log";

interface DueTimeReminderRow {
  session_id: string;
  cohort_id: string;
  scheduled_at: string;
  cohort_time_zone: string;
  video_join_url: string | null;
}

interface DueMissedSessionRow {
  session_id: string;
  cohort_id: string;
  applicant_id: string;
  scheduled_at: string;
  cohort_time_zone: string;
}

/**
 * P4's own actual reminder schedule, found missing entirely during a
 * 2026-09-05 acceptance audit - see the two migrations this calls
 * (20260905150000, 20260905160000) and lib/messaging/session-
 * notifications.ts's own notifySessionReminder/notifyMissedSession for
 * the full finding. This is the last of the three gap-closure PRs: the
 * cron tick that actually calls what the other two built.
 *
 * Runs every 15 minutes rather than trying to fire at one exact instant
 * per session - a session can match a "due" window on several
 * consecutive ticks, but notification_log's own unique
 * (dedup_key, channel) index is what actually guarantees a single send
 * (see the migration's own comment), so this function only has to ask
 * "what's due right now," never track what it already sent itself.
 *
 * Pure logic separate from the Inngest wiring below, same split as
 * ping.ts - testable without spinning up the framework.
 *
 * `admin`/`missedSessionNow` are optional and exist for testability,
 * matching every other privileged action in this codebase - real
 * callers (the cron trigger below) never pass either. missedSessionNow
 * threads straight through to applicants_due_for_missed_session_followup's
 * own p_now override, since that function's whole behavior hinges on
 * comparing against the current calendar day/hour - the 24h/1h windows
 * don't need the same treatment, since a test can control them with
 * ordinary relative offsets from the real now().
 */
export async function handleSessionReminders(
  admin: SupabaseClient = createAdminClient(),
  missedSessionNow?: Date,
): Promise<{ reminder24h: number; reminder1h: number; missedSession: number }> {
  const [due24h, due1h, dueMissed] = await Promise.all([
    admin.rpc("sessions_due_for_time_reminder", { p_window: "24 hours" }),
    admin.rpc("sessions_due_for_time_reminder", { p_window: "1 hour" }),
    admin.rpc(
      "applicants_due_for_missed_session_followup",
      missedSessionNow ? { p_now: missedSessionNow.toISOString() } : undefined,
    ),
  ]);
  if (due24h.error) throw due24h.error;
  if (due1h.error) throw due1h.error;
  if (dueMissed.error) throw dueMissed.error;

  const rows24h = (due24h.data ?? []) as DueTimeReminderRow[];
  const rows1h = (due1h.data ?? []) as DueTimeReminderRow[];
  const rowsMissed = (dueMissed.data ?? []) as DueMissedSessionRow[];

  await Promise.all(
    rows24h.map((row) =>
      notifySessionReminder(
        admin,
        row.cohort_id,
        row.session_id,
        new Date(row.scheduled_at),
        row.cohort_time_zone,
        row.video_join_url,
        "24h",
      ),
    ),
  );
  await Promise.all(
    rows1h.map((row) =>
      notifySessionReminder(
        admin,
        row.cohort_id,
        row.session_id,
        new Date(row.scheduled_at),
        row.cohort_time_zone,
        row.video_join_url,
        "1h",
      ),
    ),
  );
  await Promise.all(
    rowsMissed.map((row) =>
      notifyMissedSession(
        admin,
        row.applicant_id,
        row.session_id,
        row.cohort_id,
        new Date(row.scheduled_at),
        row.cohort_time_zone,
      ),
    ),
  );

  log("session_reminders_tick", {
    reminder_24h_count: rows24h.length,
    reminder_1h_count: rows1h.length,
    missed_session_count: rowsMissed.length,
  });

  return { reminder24h: rows24h.length, reminder1h: rows1h.length, missedSession: rowsMissed.length };
}

export const sessionRemindersFunction = inngest.createFunction(
  { id: "session-reminders", triggers: { cron: "*/15 * * * *" } },
  () => handleSessionReminders(),
);
