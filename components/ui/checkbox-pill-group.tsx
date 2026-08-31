"use client";

// CheckboxPillGroup | same visual pattern as RadioPillGroup, multi-select -
// L2's availability question (someone can be free multiple windows).
export interface CheckboxPillOption {
  value: string;
  label: string;
}

export function CheckboxPillGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: CheckboxPillOption[];
  value: string[];
  onChange: (value: string[]) => void;
}) {
  function toggle(optionValue: string) {
    if (value.includes(optionValue)) {
      onChange(value.filter((v) => v !== optionValue));
    } else {
      onChange([...value, optionValue]);
    }
  }

  return (
    <div role="group" aria-label={label} className="grid grid-cols-2 gap-2">
      {options.map((option) => {
        const selected = value.includes(option.value);
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
              type="checkbox"
              checked={selected}
              onChange={() => toggle(option.value)}
              className="sr-only"
            />
            {option.label}
          </label>
        );
      })}
    </div>
  );
}
