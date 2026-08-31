"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCohortAction, type CreateCohortInput } from "@/lib/admin/cohort-creation";
import type { SelectableProgram, SelectableFacilitator } from "@/lib/admin/cohorts";
import { Button } from "@/components/ui/button";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const FIELD_CLASSES =
  "min-h-12 w-full rounded-control border border-line bg-surface px-4 py-3 text-body font-ui text-ink";

export function CohortCreationForm({
  programs,
  facilitators,
}: {
  programs: SelectableProgram[];
  facilitators: SelectableFacilitator[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [zoomWarning, setZoomWarning] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    groupingDescription: "",
    programId: programs[0]?.id ?? "",
    facilitatorId: facilitators[0]?.id ?? "",
    cadence: "weekly" as CreateCohortInput["cadence"],
    meetingDayOfWeek: 2,
    meetingTime: "18:30",
    timeZone: "America/New_York",
    firstSessionDate: "",
    capacity: 8,
    deliveryFormat: "video" as CreateCohortInput["deliveryFormat"],
  });

  const canSubmit = programs.length > 0 && facilitators.length > 0;

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setZoomWarning(null);
    startTransition(async () => {
      const result = await createCohortAction(form);
      if (!result.success) {
        setError(result.error);
        return;
      }
      if (result.status === "draft") {
        // Cohort was still created - not a hard failure - so the admin
        // is taken to it and shown exactly what went wrong, per this
        // session's spec: "the cohort is created in draft and surfaces
        // the error. Do not create a cohort with silently missing join
        // links."
        setZoomWarning(result.zoomError);
        router.push(`/admin/cohorts/${result.cohortId}`);
        return;
      }
      router.push(`/admin/cohorts/${result.cohortId}`);
    });
  }

  if (!canSubmit) {
    return (
      <p className="text-body font-ui text-ink-soft">
        {programs.length === 0
          ? "No licensed programs are selectable yet."
          : "No facilitator accounts exist yet."}{" "}
        A cohort needs both before one can be created.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <label htmlFor="name" className="text-label font-ui text-ink">
          Cohort name
        </label>
        <input
          id="name"
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className={FIELD_CLASSES}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="groupingDescription" className="text-label font-ui text-ink">
          Grouping description
        </label>
        <input
          id="groupingDescription"
          required
          placeholder="e.g. Spouses, early stage"
          value={form.groupingDescription}
          onChange={(e) => setForm({ ...form, groupingDescription: e.target.value })}
          className={FIELD_CLASSES}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="programId" className="text-label font-ui text-ink">
          Program
        </label>
        <select
          id="programId"
          value={form.programId}
          onChange={(e) => setForm({ ...form, programId: e.target.value })}
          className={FIELD_CLASSES}
        >
          {programs.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.sessionCount} sessions)
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="facilitatorId" className="text-label font-ui text-ink">
          Facilitator
        </label>
        <select
          id="facilitatorId"
          value={form.facilitatorId}
          onChange={(e) => setForm({ ...form, facilitatorId: e.target.value })}
          className={FIELD_CLASSES}
        >
          {facilitators.map((f) => (
            <option key={f.id} value={f.id}>
              {f.email}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-4">
        <div className="flex flex-1 flex-col gap-2">
          <label htmlFor="cadence" className="text-label font-ui text-ink">
            Cadence
          </label>
          <select
            id="cadence"
            value={form.cadence}
            onChange={(e) => setForm({ ...form, cadence: e.target.value as CreateCohortInput["cadence"] })}
            className={FIELD_CLASSES}
          >
            <option value="weekly">Weekly</option>
            <option value="biweekly">Biweekly</option>
          </select>
        </div>
        <div className="flex flex-1 flex-col gap-2">
          <label htmlFor="deliveryFormat" className="text-label font-ui text-ink">
            Delivery format
          </label>
          <select
            id="deliveryFormat"
            value={form.deliveryFormat}
            onChange={(e) =>
              setForm({ ...form, deliveryFormat: e.target.value as CreateCohortInput["deliveryFormat"] })
            }
            className={FIELD_CLASSES}
          >
            <option value="video">Video</option>
            <option value="in_person">In person</option>
          </select>
        </div>
      </div>

      <div className="flex gap-4">
        <div className="flex flex-1 flex-col gap-2">
          <label htmlFor="meetingDayOfWeek" className="text-label font-ui text-ink">
            Meeting day
          </label>
          <select
            id="meetingDayOfWeek"
            value={form.meetingDayOfWeek}
            onChange={(e) => setForm({ ...form, meetingDayOfWeek: Number(e.target.value) })}
            className={FIELD_CLASSES}
          >
            {WEEKDAYS.map((day, index) => (
              <option key={day} value={index}>
                {day}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-1 flex-col gap-2">
          <label htmlFor="meetingTime" className="text-label font-ui text-ink">
            Meeting time
          </label>
          <input
            id="meetingTime"
            type="time"
            required
            value={form.meetingTime}
            onChange={(e) => setForm({ ...form, meetingTime: e.target.value })}
            className={FIELD_CLASSES}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="timeZone" className="text-label font-ui text-ink">
          Time zone
        </label>
        <input
          id="timeZone"
          required
          placeholder="America/New_York"
          value={form.timeZone}
          onChange={(e) => setForm({ ...form, timeZone: e.target.value })}
          className={FIELD_CLASSES}
        />
        <p className="text-meta font-ui text-ink-soft">IANA identifier, e.g. America/New_York, America/Chicago.</p>
      </div>

      <div className="flex gap-4">
        <div className="flex flex-1 flex-col gap-2">
          <label htmlFor="firstSessionDate" className="text-label font-ui text-ink">
            First session date
          </label>
          <input
            id="firstSessionDate"
            type="date"
            required
            value={form.firstSessionDate}
            onChange={(e) => setForm({ ...form, firstSessionDate: e.target.value })}
            className={FIELD_CLASSES}
          />
        </div>
        <div className="flex flex-1 flex-col gap-2">
          <label htmlFor="capacity" className="text-label font-ui text-ink">
            Capacity
          </label>
          <input
            id="capacity"
            type="number"
            min={1}
            required
            value={form.capacity}
            onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })}
            className={FIELD_CLASSES}
          />
        </div>
      </div>

      {error ? <p className="text-meta font-ui text-ink">{error}</p> : null}
      {zoomWarning ? (
        <p className="text-meta font-ui text-ink">
          The cohort was created, but Zoom setup failed: {zoomWarning}. It&apos;s in draft - taking you there now.
        </p>
      ) : null}

      <div className="flex gap-4">
        <Button type="submit" loading={pending}>
          Create cohort
        </Button>
      </div>
    </form>
  );
}
