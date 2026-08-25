"use client";

import { useEffect, useRef, useState } from "react";
import { Button, type ButtonVariant } from "@/components/ui/button";
import { TextArea } from "@/components/ui/text-area";

export interface ComposerProps {
  /** localStorage key this draft autosaves under — unique per post or reply thread. */
  draftKey: string;
  label: string;
  submitLabel: string;
  submitVariant?: ButtonVariant;
  autoFocus?: boolean;
  onSubmit: (body: string) => void;
}

const MAX_LENGTH = 4000;

// Composer | plain text only, no rich text, no attachments (CLAUDE.md).
// Drafts autosave to localStorage on every change and survive a closed tab —
// this population gets interrupted mid-sentence constantly. Collapsed to one
// line until focused or drafted (Part 3.4); a reply composer starts already
// expanded since tapping Reply is itself the focus signal.
export function Composer({ draftKey, label, submitLabel, submitVariant = "primary", autoFocus = false, onSubmit }: ComposerProps) {
  const [draft, setDraft] = useState("");
  const [focused, setFocused] = useState(false);
  const hydrated = useRef(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(draftKey);
    if (saved) setDraft(saved);
    hydrated.current = true;
  }, [draftKey]);

  useEffect(() => {
    if (!hydrated.current) return;
    if (draft) {
      window.localStorage.setItem(draftKey, draft);
    } else {
      window.localStorage.removeItem(draftKey);
    }
  }, [draft, draftKey]);

  const trimmed = draft.trim();
  const expanded = focused || draft.length > 0;

  function handleSubmit() {
    if (!trimmed) return;
    onSubmit(trimmed);
    setDraft("");
    window.localStorage.removeItem(draftKey);
  }

  return (
    <div className="flex flex-col gap-3">
      <TextArea
        label={label}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoFocus={autoFocus}
        maxLength={MAX_LENGTH}
        draftSaved={draft.length > 0}
        rows={expanded ? 4 : 1}
        style={expanded ? undefined : { minHeight: "3rem" }}
      />
      <Button
        variant={submitVariant}
        className="w-full sm:w-fit sm:self-end"
        disabled={!trimmed}
        onClick={handleSubmit}
      >
        {submitLabel}
      </Button>
    </div>
  );
}
