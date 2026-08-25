"use client";

import { useId } from "react";
import type { TextareaHTMLAttributes } from "react";
import { COPY } from "@/lib/copy";

export interface TextAreaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id"> {
  label: string;
  error?: string;
  maxLength?: number;
  /** Shows the discussion.draft_saved string. Static text, not a toast — never auto-dismisses. */
  draftSaved?: boolean;
}

// TextArea | default, focus, error, disabled · autosave indicator, character
// limit. Errors never use red: --gentle carries an icon, the message itself
// stays --ink so it keeps AA contrast in both themes.
export function TextArea({
  label,
  error,
  maxLength,
  draftSaved = false,
  value,
  disabled,
  className = "",
  ...rest
}: TextAreaProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const countId = `${id}-count`;
  const length = typeof value === "string" ? value.length : 0;
  const describedBy = [error ? errorId : null, maxLength ? countId : null].filter(Boolean).join(" ");

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-label font-ui text-ink">
        {label}
      </label>
      <textarea
        id={id}
        value={value}
        disabled={disabled}
        maxLength={maxLength}
        aria-invalid={!!error || undefined}
        aria-describedby={describedBy || undefined}
        className={`min-h-32 w-full rounded-control border bg-surface px-4 py-3 text-body font-ui text-ink placeholder:text-ink-soft disabled:cursor-not-allowed disabled:opacity-50 ${
          error ? "border-gentle" : "border-line"
        } ${className}`}
        {...rest}
      />
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {error ? (
            <>
              <svg
                aria-hidden="true"
                viewBox="0 0 16 16"
                fill="currentColor"
                className="h-4 w-4 shrink-0 text-gentle"
              >
                <path d="M8 1a1 1 0 0 1 .894.553l6.5 13A1 1 0 0 1 14.5 16h-13a1 1 0 0 1-.894-1.447l6.5-13A1 1 0 0 1 8 1Zm0 4.5a.75.75 0 0 0-.75.75v4a.75.75 0 0 0 1.5 0v-4A.75.75 0 0 0 8 5.5Zm0 6.5a.9.9 0 1 0 0 1.8.9.9 0 0 0 0-1.8Z" />
              </svg>
              <p id={errorId} className="text-meta font-ui text-ink">
                {error}
              </p>
            </>
          ) : draftSaved ? (
            <p className="text-meta font-ui text-ink-soft">{COPY.discussion.draft_saved}</p>
          ) : null}
        </div>
        {maxLength ? (
          <p id={countId} className="shrink-0 text-meta font-ui text-ink-soft">
            {length} / {maxLength}
          </p>
        ) : null}
      </div>
    </div>
  );
}
