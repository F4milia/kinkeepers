"use client";

import { COPY } from "@/lib/copy";
import type { AttendanceStatus } from "@/lib/fixtures";

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
export function AttendanceRadioGroup({ name, label, value, onChange }: AttendanceRadioGroupProps) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {OPTIONS.map((option) => {
        const selected = value === option.value;
        const isUnmarked = option.value === "unmarked";
        return (
          <label
            key={option.value}
            className={`inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-control border px-4 text-label font-ui transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-action has-[:focus-visible]:outline-offset-2 ${
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
