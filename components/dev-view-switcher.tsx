"use client";

import { useRouter } from "next/navigation";
import { DEV_VIEW_COOKIE, DEV_VIEW_COOKIE_MAX_AGE, type DevView } from "@/lib/dev-view";

const VIEWS: { value: DevView; label: string }[] = [
  { value: "caregiver", label: "Caregiver" },
  { value: "facilitator", label: "Facilitator" },
];

/**
 * Demo scaffolding, not a product feature (CLAUDE.md) — flips this session
 * between the caregiver and facilitator views so a presenter can show both
 * without two logins.
 *
 * The build doc asks that this stay visibly scaffolding. It does that with a
 * dashed --gentle outline and a plain label rather than an off-system
 * palette: a black-and-yellow brutalist bar reads as a defect in a screen
 * about someone's spouse, and the first audience is a clinical reviewer who
 * will see it before they see anything else. The dashed edge and the words
 * "Demo only" carry that signal without the alarm. The segmented control
 * itself matches ThemeToggle, so the one piece a presenter actually operates
 * behaves like the rest of the app.
 */
export function DevViewSwitcher({ initialView }: { initialView: DevView }) {
  const router = useRouter();

  function apply(next: DevView) {
    if (next === initialView) return;
    document.cookie = `${DEV_VIEW_COOKIE}=${next}; path=/; max-age=${DEV_VIEW_COOKIE_MAX_AGE}; SameSite=Lax`;
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-dashed border-gentle bg-surface px-4 py-3">
      <p className="text-meta font-ui text-ink-soft">Demo only — viewing as</p>
      <div className="inline-flex overflow-hidden rounded-control border border-line" role="group" aria-label="Demo view">
        {VIEWS.map((view, index) => (
          <button
            key={view.value}
            type="button"
            aria-pressed={initialView === view.value}
            onClick={() => apply(view.value)}
            className={`min-h-12 px-4 text-label font-ui transition-colors ${index > 0 ? "border-l border-line" : ""} ${
              initialView === view.value ? "bg-action-dim text-action" : "bg-surface text-ink-soft hover:text-ink"
            }`}
          >
            {view.label}
          </button>
        ))}
      </div>
    </div>
  );
}
