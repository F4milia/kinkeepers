"use client";

import { useState, useTransition } from "react";
import {
  rescheduleSessionAction,
  cancelSessionAction,
  recordSessionSubstituteAction,
} from "@/lib/admin/session-management";
import { zonedWallTimeToUtc } from "@/lib/admin/cohort-meeting-time";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { SelectableFacilitator } from "@/lib/admin/cohorts";

const FIELD_CLASSES = "min-h-12 rounded-control border border-line bg-surface px-3 py-2 text-meta font-ui text-ink";

/** Wall-clock date/time parts of `instant`, rendered in `timeZone` - the
 * values a date/time input pair needs to prefill in the cohort's own
 * zone, not the browser's local zone. */
function wallClockInputDefaults(instant: Date, timeZone: string): { date: string; time: string } {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(formatter.formatToParts(instant).map((p) => [p.type, p.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

export function SessionActions({
  sessionId,
  scheduledAt,
  timeZone,
  facilitators,
  currentSubstituteFacilitatorId,
}: {
  sessionId: string;
  scheduledAt: string;
  timeZone: string;
  facilitators: SelectableFacilitator[];
  currentSubstituteFacilitatorId: string | null;
}) {
  const defaults = wallClockInputDefaults(new Date(scheduledAt), timeZone);
  const [rescheduleDate, setRescheduleDate] = useState(defaults.date);
  const [rescheduleTime, setRescheduleTime] = useState(defaults.time);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [substituteId, setSubstituteId] = useState(currentSubstituteFacilitatorId ?? "");
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleReschedule(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setWarning(null);
    const [year, month, day] = rescheduleDate.split("-").map(Number);
    const [hour, minute] = rescheduleTime.split(":").map(Number);
    const newInstant = zonedWallTimeToUtc(year, month, day, hour, minute, timeZone);
    startTransition(async () => {
      const result = await rescheduleSessionAction(sessionId, newInstant.toISOString());
      if (!result.success) {
        setError(result.error);
        return;
      }
      if ("zoomWarning" in result) setWarning(result.zoomWarning);
    });
  }

  function handleCancelConfirm() {
    setError(null);
    setWarning(null);
    startTransition(async () => {
      const result = await cancelSessionAction(sessionId, cancelReason);
      if (!result.success) {
        setError(result.error);
        return;
      }
      if ("zoomWarning" in result) setWarning(result.zoomWarning);
      setCancelOpen(false);
    });
  }

  function handleSubstituteSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await recordSessionSubstituteAction(sessionId, substituteId || null);
      if (!result.success) setError(result.error);
    });
  }

  return (
    <div className="mt-3 flex flex-col gap-3 border-t border-line pt-3">
      <form onSubmit={handleReschedule} className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label htmlFor={`reschedule-date-${sessionId}`} className="text-meta font-ui text-ink-soft">
            Reschedule date
          </label>
          <input
            id={`reschedule-date-${sessionId}`}
            type="date"
            required
            value={rescheduleDate}
            onChange={(e) => setRescheduleDate(e.target.value)}
            className={FIELD_CLASSES}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`reschedule-time-${sessionId}`} className="text-meta font-ui text-ink-soft">
            Time ({timeZone})
          </label>
          <input
            id={`reschedule-time-${sessionId}`}
            type="time"
            required
            value={rescheduleTime}
            onChange={(e) => setRescheduleTime(e.target.value)}
            className={FIELD_CLASSES}
          />
        </div>
        <Button type="submit" variant="secondary" loading={pending}>
          Reschedule
        </Button>
      </form>

      <form onSubmit={handleSubstituteSubmit} className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label htmlFor={`substitute-${sessionId}`} className="text-meta font-ui text-ink-soft">
            Substitute facilitator
          </label>
          <select
            id={`substitute-${sessionId}`}
            value={substituteId}
            onChange={(e) => setSubstituteId(e.target.value)}
            className={FIELD_CLASSES}
          >
            <option value="">None - cohort&apos;s own facilitator</option>
            {facilitators.map((f) => (
              <option key={f.id} value={f.id}>
                {f.email}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" variant="secondary" loading={pending}>
          Save substitute
        </Button>
      </form>

      <div className="flex items-end gap-2">
        <input
          type="text"
          required
          placeholder="Reason for cancelling"
          value={cancelReason}
          onChange={(e) => setCancelReason(e.target.value)}
          aria-label="Reason for cancelling this session"
          className={`${FIELD_CLASSES} flex-1`}
        />
        <Button
          type="button"
          variant="destructive"
          disabled={cancelReason.trim().length === 0}
          onClick={() => setCancelOpen(true)}
        >
          Cancel session
        </Button>
      </div>

      {error ? <p className="text-meta font-ui text-ink">{error}</p> : null}
      {warning ? <p className="text-meta font-ui text-ink">{warning}</p> : null}

      <ConfirmDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={handleCancelConfirm}
        title="Cancel this session?"
        body={`This session will be marked cancelled (reason: "${cancelReason}") and removed from Zoom. It will not count against the program's completion.`}
        confirmLabel={pending ? "Cancelling…" : "Cancel session"}
        cancelLabel="Keep session"
      />
    </div>
  );
}
