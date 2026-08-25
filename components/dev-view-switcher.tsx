"use client";

import { useRouter } from "next/navigation";
import { DEV_VIEW_COOKIE, DEV_VIEW_COOKIE_MAX_AGE, type DevView } from "@/lib/dev-view";

const VIEWS: { value: DevView; label: string }[] = [
  { value: "caregiver", label: "Caregiver" },
  { value: "facilitator", label: "Facilitator" },
];

/**
 * Demo scaffolding, not a product feature (CLAUDE.md) — flips /session
 * between the caregiver and facilitator views so a presenter can show both
 * without two logins. Deliberately styled outside the design system
 * (monospace, dashed border, raw Tailwind palette instead of tokens) so it
 * reads as a tool, never as part of the product a clinical reviewer is
 * evaluating. This is the one intentional exception to "no raw hex outside
 * the token file" — it exists precisely so it does NOT look like the rest
 * of the app.
 */
export function DevViewSwitcher({ initialView }: { initialView: DevView }) {
  const router = useRouter();

  function apply(next: DevView) {
    if (next === initialView) return;
    document.cookie = `${DEV_VIEW_COOKIE}=${next}; path=/; max-age=${DEV_VIEW_COOKIE_MAX_AGE}; SameSite=Lax`;
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-3 border-b-2 border-dashed border-neutral-500 bg-neutral-900 px-4 py-2">
      <span className="font-mono text-meta font-bold uppercase tracking-wide text-neutral-400">
        Demo only — viewing as
      </span>
      <div className="flex overflow-hidden rounded border border-neutral-600" role="group" aria-label="Demo view">
        {VIEWS.map((view) => (
          <button
            key={view.value}
            type="button"
            aria-pressed={initialView === view.value}
            onClick={() => apply(view.value)}
            className={`min-h-12 px-4 font-mono text-meta font-bold transition-colors ${
              initialView === view.value ? "bg-yellow-400 text-black" : "bg-neutral-800 text-neutral-200 hover:bg-neutral-700"
            }`}
          >
            {view.label}
          </button>
        ))}
      </div>
    </div>
  );
}
