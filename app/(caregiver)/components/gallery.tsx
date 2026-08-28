"use client";

import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Sheet } from "@/components/ui/sheet";
import { TabBar } from "@/components/ui/tab-bar";
import { TextArea } from "@/components/ui/text-area";
import { AttendanceRadioGroup, type AttendanceStatus } from "@/components/ui/attendance-radio-group";
import { ThemeToggle } from "@/components/theme-toggle";
import { COPY, format } from "@/lib/copy";
import type { Theme } from "@/lib/theme";

const BUTTON_VARIANTS = ["primary", "secondary", "quiet", "destructive"] as const;
const AVATAR_SIZES = [32, 40, 56] as const;
const BADGE_VARIANTS = ["neutral", "gentle", "urgent"] as const;

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 border-t border-line pt-section first:border-t-0 first:pt-0">
      <div>
        <h2>{title}</h2>
        {note && <p className="mt-1 text-meta font-ui text-ink-soft">{note}</p>}
      </div>
      {children}
    </section>
  );
}

function StateLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 text-meta font-ui text-ink-soft">{children}</p>;
}

export function ComponentGallery({ initialTheme }: { initialTheme: Theme }) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmedCount, setConfirmedCount] = useState(0);

  const [notesValue, setNotesValue] = useState("");
  const [draftSaved, setDraftSaved] = useState(false);
  const [errorValue, setErrorValue] = useState("");

  const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>({
    denise: "present",
    rosalind: "unmarked",
    terry: "absent",
    paul: "excused",
  });

  function setMemberAttendance(memberId: string, status: AttendanceStatus) {
    setAttendance((current) => ({ ...current, [memberId]: status }));
  }

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-section px-4 py-section pb-32 md:pl-64">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-6">
        <div>
          <h1>Component library</h1>
          <p className="mt-1 text-body font-ui text-ink-soft">
            Every component from Part 3.3, every listed state. Toggle theme to review both modes.
            Hover, focus, and active states are live — tab through and mouse over the controls
            below rather than looking for a frozen snapshot of them.
          </p>
        </div>
        <ThemeToggle initialTheme={initialTheme} />
      </div>

      <Section title="Button" note="primary is 56px tall; secondary, quiet, and destructive are 48px minimum.">
        <div className="flex flex-col gap-6">
          {BUTTON_VARIANTS.map((variant) => (
            <div key={variant}>
              <StateLabel>{variant} — default, disabled, loading (hover/focus/active are live)</StateLabel>
              <div className="flex flex-wrap items-center gap-4">
                <Button variant={variant}>{COPY.log.submit}</Button>
                <Button variant={variant} disabled>
                  {COPY.log.submit}
                </Button>
                <Button variant={variant} loading>
                  {COPY.log.submit}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Avatar" note="Initials only, deterministic per name — no photographs anywhere.">
        <div className="flex flex-wrap items-end gap-6">
          {AVATAR_SIZES.map((size) => (
            <div key={size} className="flex flex-col items-center gap-2">
              <Avatar name="Rosalind" size={size} decorative={false} />
              <p className="text-meta font-ui text-ink-soft">{size}px</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Card" note="default and interactive (hover + keyboard focus).">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <StateLabel>default</StateLabel>
            <Card>
              <p className="text-label font-ui text-ink">{COPY.home.next_meetup}</p>
              <p className="mt-1 text-body font-ui text-ink-soft">
                {format(COPY.home.progress, { n: 5, total: 6 })}
              </p>
            </Card>
          </div>
          <div>
            <StateLabel>interactive — hover or tab to it</StateLabel>
            <Card interactive onClick={() => {}} aria-label={COPY.discussion.title}>
              <p className="text-label font-ui text-ink">{COPY.discussion.title}</p>
              <p className="mt-1 text-body font-ui text-ink-soft">{COPY.home.view_all}</p>
            </Card>
          </div>
        </div>
      </Section>

      <Section title="Badge" note="Neutral, gentle, urgent. Label text always stays --ink; the token color is the dot and border only.">
        <div className="flex flex-wrap gap-3">
          {BADGE_VARIANTS.map((variant) => (
            <Badge key={variant} variant={variant}>
              {variant === "neutral"
                ? COPY.cohort.facilitator_label
                : variant === "gentle"
                  ? COPY.log.unmarked
                  : COPY.nav.support}
            </Badge>
          ))}
        </div>
      </Section>

      <Section title="EmptyState" note="Headline + body, no illustration.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <EmptyState headline={COPY.discussion.title} body={COPY.discussion.empty} />
          </Card>
          <Card>
            <EmptyState headline={COPY.cohort.title} body={COPY.cohort.empty} />
          </Card>
          <Card>
            <EmptyState headline={COPY.home.recent} body={COPY.home.empty_posts} />
          </Card>
          <Card>
            <EmptyState headline={COPY.home.next_meetup} body={COPY.home.empty_meetup} />
          </Card>
        </div>
      </Section>

      <Section title="TextArea" note="default, focus (tab into any field to see it live), error, disabled · autosave indicator, character limit.">
        <div className="grid gap-6 sm:grid-cols-2">
          <TextArea
            label={COPY.discussion.reply}
            placeholder={COPY.discussion.reply_placeholder}
            value={notesValue}
            maxLength={280}
            onChange={(event) => {
              setNotesValue(event.target.value);
              setDraftSaved(event.target.value.length > 0);
            }}
            draftSaved={draftSaved}
          />
          <TextArea
            label={COPY.log.notes}
            placeholder={COPY.log.notes_placeholder}
            value={errorValue}
            error={errorValue.length === 0 ? COPY.error.required : undefined}
            onChange={(event) => setErrorValue(event.target.value)}
          />
          <TextArea label={COPY.log.notes} defaultValue="" disabled placeholder={COPY.log.notes_placeholder} />
        </div>
      </Section>

      <Section title="RadioGroup" note="Attendance — unmarked is a real, visible state, not a default lack of input.">
        <div className="flex flex-col gap-4">
          {[
            { id: "denise", name: "Denise" },
            { id: "rosalind", name: "Rosalind" },
            { id: "terry", name: "Terry" },
            { id: "paul", name: "Paul" },
          ].map((member) => (
            <div key={member.id} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
              <p className="w-24 shrink-0 text-label font-ui text-ink">{member.name}</p>
              <AttendanceRadioGroup
                name={`attendance-${member.id}`}
                label={`${COPY.log.attendance} — ${member.name}`}
                value={attendance[member.id]}
                onChange={(status) => setMemberAttendance(member.id, status)}
              />
            </div>
          ))}
        </div>
      </Section>

      <Section title="Sheet" note="Bottom sheet on mobile, centered dialog on desktop — resize to compare. Escape, backdrop click, and Tab-trapped focus all work.">
        <Button variant="secondary" onClick={() => setSheetOpen(true)}>
          {COPY.support.title}
        </Button>
        <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title={COPY.support.title}>
          <p className="text-body font-ui text-ink">{COPY.support.body}</p>
          <p className="mt-4 text-meta font-ui text-ink-soft">{COPY.support.note}</p>
          <Button className="mt-6 w-full" onClick={() => setSheetOpen(false)}>
            {format(COPY.support.call, { phoneNumber: COPY.support.phoneNumber })}
          </Button>
        </Sheet>
      </Section>

      <Section title="ConfirmDialog" note="Built on Sheet. Cancel is first in DOM order and the close icon is hidden, so confirm is never the default focus.">
        <div className="flex items-center gap-4">
          <Button variant="destructive" onClick={() => setConfirmOpen(true)}>
            {COPY.log.submit}
          </Button>
          <p className="text-meta font-ui text-ink-soft">Confirmed {confirmedCount} time(s)</p>
        </div>
        <ConfirmDialog
          open={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          onConfirm={() => {
            setConfirmedCount((n) => n + 1);
            setConfirmOpen(false);
          }}
          title={COPY.log.confirm_title}
          body={COPY.log.confirm_body}
          confirmLabel={COPY.log.confirm_yes}
          cancelLabel={COPY.log.confirm_cancel}
        />
      </Section>

      <Section
        title="TabBar"
        note="Rendered live at the edge of this page — bottom bar under 768px, left rail at 768px and up. Nav targets (My group, Discussion, Get help now) 404 until their screens are built in a later session; Home is this page's own root."
      >
        <p className="text-meta font-ui text-ink-soft">See the fixed bar at the bottom (or left, on a wider viewport).</p>
      </Section>

      <Section title="ThemeToggle" note="Light, dark — persists via the kk_theme cookie. The instance in the page header above is this component; toggle it to review every section in both modes.">
        <ThemeToggle initialTheme={initialTheme} />
      </Section>

      <TabBar />
    </main>
  );
}
