"use client";

import { useId } from "react";
import type { InputHTMLAttributes } from "react";

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  label: string;
  error?: string;
}

// TextField | single-line input, same convention as TextArea: error border
// is --gentle (never red), the message stays --ink with a leading icon so
// it keeps AA contrast in both themes.
export function TextField({ label, error, disabled, className = "", ...rest }: TextFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-label font-ui text-ink">
        {label}
      </label>
      <input
        id={id}
        disabled={disabled}
        aria-invalid={!!error || undefined}
        aria-describedby={error ? errorId : undefined}
        className={`min-h-12 w-full rounded-control border bg-surface px-4 text-body font-ui text-ink placeholder:text-ink-soft disabled:cursor-not-allowed disabled:opacity-50 ${
          error ? "border-gentle" : "border-line"
        } ${className}`}
        {...rest}
      />
      {error ? (
        <div className="flex items-center gap-2">
          <svg aria-hidden="true" viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4 shrink-0 text-gentle">
            <path d="M8 1a1 1 0 0 1 .894.553l6.5 13A1 1 0 0 1 14.5 16h-13a1 1 0 0 1-.894-1.447l6.5-13A1 1 0 0 1 8 1Zm0 4.5a.75.75 0 0 0-.75.75v4a.75.75 0 0 0 1.5 0v-4A.75.75 0 0 0 8 5.5Zm0 6.5a.9.9 0 1 0 0 1.8.9.9 0 0 0 0-1.8Z" />
          </svg>
          <p id={errorId} className="text-meta font-ui text-ink">
            {error}
          </p>
        </div>
      ) : null}
    </div>
  );
}
