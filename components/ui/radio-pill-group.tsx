"use client";

// RadioPillGroup | generic single-select pill group, same visual/keyboard
// pattern as AttendanceRadioGroup but not tied to attendance's fixed
// option set - reused here for L2's stage and contact-preference questions.
export interface RadioPillOption {
  value: string;
  label: string;
}

export function RadioPillGroup({
  name,
  label,
  options,
  value,
  onChange,
}: {
  name: string;
  label: string;
  options: RadioPillOption[];
  value: string | null;
  onChange: (value: string) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-2 gap-2">
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <label
            key={option.value}
            className={`flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-control border px-3 text-center text-label font-ui transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-action has-[:focus-visible]:outline-offset-2 ${
              selected
                ? "border-action bg-action-dim text-action"
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
