"use client";

import { COPY } from "@/lib/copy";
import type { AttendanceStatus } from "@/lib/types";

export type { AttendanceStatus };

const OPTIONS: { value: AttendanceStatus; label: string }[] = [
  { value: "present", label: COPY.log.present },
  { value: "absent", label: COPY.log.absent },
  { value: "excused", label: COPY.log.excused },
  { value: "unmarked", label: COPY.log.unmarked },
];

export interface AttendanceRadioGroupProps {
  name: string;
  label: string;
  value: AttendanceStatus;
  onChange: (value: AttendanceStatus) => void;
}

// RadioGroup | attendance · unmarked is a real, explicitly selectable state —
// not just the absence of a choice — so a facilitator can see at a glance who
// still needs marking (log.unmarked_warning, non-blocking).
//
// A fixed grid rather than flex-wrap: with wrapping, a longer name (or a
// facilitator's role badge) changed how many options fit on a line, so rows
// disagreed about where the options started and how tall they were. Two
// columns on a phone, four once there's room — every row identical either
// way, and "Not marked" always gets a full cell instead of being the one
// that wraps.
export function AttendanceRadioGroup({ name, label, value, onChange }: AttendanceRadioGroupProps) {
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {OPTIONS.map((option) => {
        const selected = value === option.value;
        const isUnmarked = option.value === "unmarked";
        return (
          <label
            key={option.value}
            className={`flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-control border px-3 text-center text-label font-ui transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-action has-[:focus-visible]:outline-offset-2 ${
              selected
                ? isUnmarked
                  ? "border-gentle bg-surface text-ink"
                  : "border-action bg-action-dim text-action"
                : "border-line bg-surface text-ink-soft hover:border-action"
            }`}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={selected}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            {option.label}
          </label>
        );
      })}
    </div>
  );
}
