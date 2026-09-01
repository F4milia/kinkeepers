"use client";

import { useEffect, useRef, useState } from "react";
import { AttendanceRadioGroup, type AttendanceStatus } from "@/components/ui/attendance-radio-group";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { TextArea } from "@/components/ui/text-area";
import { COPY, format } from "@/lib/copy";
import { formatLongDate, formatSessionDay } from "@/lib/format-date";
import type { CohortMember, Session } from "@/lib/types";

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  present: COPY.log.present,
  absent: COPY.log.absent,
  excused: COPY.log.excused,
  unmarked: COPY.log.unmarked,
};

interface EditChange {
  label: string;
  previousValue: string;
}

interface EditEntry {
  by: string;
  date: string;
  changes: EditChange[];
}

interface LogDraft {
  attendance: Record<string, AttendanceStatus>;
  notes: string;
  deliveryConfirmed: boolean;
}

export interface FacilitatorSessionLogProps {
  session: Session;
  members: CohortMember[];
  facilitatorName: string;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function seedAttendance(session: Session, members: CohortMember[]): Record<string, AttendanceStatus> {
  const seed: Record<string, AttendanceStatus> = {};
  members.forEach((member) => {
    seed[member.id] = session.attendanceByMember?.[member.id] ?? "unmarked";
  });
  return seed;
}

// Facilitator log | Part 3.4 + build doc scope note: a convenience layer
// over the health system's own documentation, not the CMS record — but
// mentor payouts still calculate against it, so it's a financial record.
// Attendance is explicit per member (unmarked is real, never implied
// absent), delivery is confirmed by an explicit control, and every edit
// after the first submission stays visible alongside the value it
// replaced.
export function FacilitatorSessionLog({ session, members, facilitatorName }: FacilitatorSessionLogProps) {
  const roster = [...members].sort((a, b) => (a.role === b.role ? 0 : a.role === "facilitator" ? -1 : 1));
  const draftKey = `kk-draft-log-${session.id}`;

  const [attendance, setAttendance] = useState(() => seedAttendance(session, roster));
  const [savedAttendance, setSavedAttendance] = useState(() => seedAttendance(session, roster));
  const [notes, setNotes] = useState(session.notes ?? "");
  const [savedNotes, setSavedNotes] = useState(session.notes ?? "");
  const [deliveryConfirmed, setDeliveryConfirmed] = useState(session.deliveryConfirmed ?? false);
  const [savedDeliveryConfirmed, setSavedDeliveryConfirmed] = useState(session.deliveryConfirmed ?? false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submission, setSubmission] = useState(
    session.loggedBy && session.loggedDate ? { by: session.loggedBy, date: session.loggedDate } : null,
  );
  const [edits, setEdits] = useState<EditEntry[]>([]);
  const hydrated = useRef(false);

  // Facilitator log carries unsaved attendance marks and notes across a
  // reload or a closed tab, the same way the discussion composer does —
  // this is the form where losing unsaved work costs the most (CLAUDE.md
  // "every form saves drafts").
  useEffect(() => {
    const saved = window.localStorage.getItem(draftKey);
    if (saved) {
      try {
        const draft = JSON.parse(saved) as LogDraft;
        setAttendance(draft.attendance);
        setNotes(draft.notes);
        setDeliveryConfirmed(draft.deliveryConfirmed);
      } catch {
        window.localStorage.removeItem(draftKey);
      }
    }
    hydrated.current = true;
  }, [draftKey]);

  useEffect(() => {
    if (!hydrated.current) return;
    const dirty =
      notes !== savedNotes ||
      deliveryConfirmed !== savedDeliveryConfirmed ||
      roster.some((member) => attendance[member.id] !== savedAttendance[member.id]);

    if (dirty) {
      const draft: LogDraft = { attendance, notes, deliveryConfirmed };
      window.localStorage.setItem(draftKey, JSON.stringify(draft));
    } else {
      window.localStorage.removeItem(draftKey);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attendance, notes, deliveryConfirmed, draftKey]);

  const unmarkedCount = roster.filter((member) => attendance[member.id] === "unmarked").length;

  function handleConfirmSubmit() {
    const by = facilitatorName;
    const date = todayISO();

    if (submission) {
      const changes: EditChange[] = [];
      roster.forEach((member) => {
        if (attendance[member.id] !== savedAttendance[member.id]) {
          changes.push({ label: member.firstName, previousValue: STATUS_LABEL[savedAttendance[member.id]] });
        }
      });
      if (notes !== savedNotes) {
        changes.push({ label: COPY.log.notes, previousValue: savedNotes.trim() ? savedNotes : "—" });
      }
      if (changes.length > 0) {
        setEdits((current) => [...current, { by, date, changes }]);
      }
    } else {
      setSubmission({ by, date });
    }

    setSavedAttendance(attendance);
    setSavedNotes(notes);
    setSavedDeliveryConfirmed(deliveryConfirmed);
    setConfirmOpen(false);
    window.localStorage.removeItem(draftKey);
  }

  return (
    <div className="flex flex-col gap-section">
      <div>
        <h1 className="text-h2">{COPY.log.title}</h1>
        <p className="mt-2 text-body-lg font-ui text-ink-soft">
          {format(COPY.home.progress, { n: session.sessionNumber, total: session.sessionTotal })}
          {" · "}
          {formatSessionDay(session.date)}
        </p>
      </div>

      <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-control border border-line bg-surface px-4 has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-action has-[:focus-visible]:outline-offset-2">
        <input
          type="checkbox"
          checked={deliveryConfirmed}
          onChange={(event) => setDeliveryConfirmed(event.target.checked)}
          className="h-5 w-5 shrink-0 accent-action"
        />
        <span className="text-body font-ui text-ink">{COPY.log.confirm_delivery}</span>
      </label>

      <section className="flex flex-col gap-4">
        {/* Warning sits under the heading, not beside it — crowded against a
            30px serif h2 it read as part of the title rather than a status. */}
        <div className="flex flex-col gap-2">
          <h2 className="text-h3">{COPY.log.attendance}</h2>
          {unmarkedCount > 0 && (
            <div className="flex items-center gap-2">
              <svg aria-hidden="true" viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4 shrink-0 text-gentle">
                <path d="M8 1a1 1 0 0 1 .894.553l6.5 13A1 1 0 0 1 14.5 16h-13a1 1 0 0 1-.894-1.447l6.5-13A1 1 0 0 1 8 1Zm0 4.5a.75.75 0 0 0-.75.75v4a.75.75 0 0 0 1.5 0v-4A.75.75 0 0 0 8 5.5Zm0 6.5a.9.9 0 1 0 0 1.8.9.9 0 0 0 0-1.8Z" />
              </svg>
              <p className="text-meta font-ui text-ink">{format(COPY.log.unmarked_warning, { n: unmarkedCount })}</p>
            </div>
          )}
        </div>

        <ul className="flex flex-col gap-4">
          {roster.map((member) => (
            <li key={member.id} className="flex flex-col gap-3 border-b border-line pb-5 last:border-b-0">
              <div className="flex items-center gap-3">
                <Avatar name={member.firstName} />
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-label font-ui text-ink">{member.firstName}</p>
                  {member.role === "facilitator" && <Badge variant="neutral">{COPY.cohort.facilitator_label}</Badge>}
                </div>
              </div>
              <AttendanceRadioGroup
                name={`attendance-${member.id}`}
                label={`${COPY.log.attendance} — ${member.firstName}`}
                value={attendance[member.id]}
                onChange={(status) => setAttendance((current) => ({ ...current, [member.id]: status }))}
              />
            </li>
          ))}
        </ul>
      </section>

      <TextArea
        label={COPY.log.notes}
        placeholder={COPY.log.notes_placeholder}
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        maxLength={2000}
      />

      <Button variant="primary" className="w-full" disabled={!deliveryConfirmed} onClick={() => setConfirmOpen(true)}>
        {COPY.log.submit}
      </Button>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirmSubmit}
        title={COPY.log.confirm_title}
        body={COPY.log.confirm_body}
        confirmLabel={COPY.log.confirm_yes}
        cancelLabel={COPY.log.confirm_cancel}
      />

      {submission && (
        <Card className="flex flex-col gap-3">
          <p className="text-meta font-ui text-ink-soft">
            {format(COPY.log.submitted_by, { name: submission.by, date: formatLongDate(submission.date) })}
          </p>
          {edits.map((edit, index) => (
            <div key={index} className="flex flex-col gap-2 border-t border-line pt-3">
              <p className="text-meta font-ui text-ink-soft">
                {format(COPY.log.edited_by, { name: edit.by, date: formatLongDate(edit.date) })}
              </p>
              <ul className="flex flex-col gap-1">
                {edit.changes.map((change, changeIndex) => (
                  <li key={changeIndex} className="text-meta font-ui text-ink-soft">
                    {change.label} — {format(COPY.log.previous_value, { value: change.previousValue })}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
