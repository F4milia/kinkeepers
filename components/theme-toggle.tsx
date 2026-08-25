"use client";

import { useEffect, useState } from "react";
import { THEME_COOKIE, THEME_COOKIE_MAX_AGE, type Theme } from "@/lib/theme";

export function ThemeToggle({ initialTheme }: { initialTheme: Theme }) {
  const [theme, setTheme] = useState<Theme>(initialTheme);

  // Corrects the very first visit, where the server couldn't know the
  // system preference yet and the blocking init script in <head> may have
  // picked a different value than this component's SSR guess.
  useEffect(() => {
    const actual = document.documentElement.classList.contains("dark") ? "dark" : "light";
    setTheme((current) => (current === actual ? current : actual));
  }, []);

  function apply(next: Theme) {
    if (next === theme) return;
    document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=${THEME_COOKIE_MAX_AGE}; SameSite=Lax`;
    document.documentElement.classList.toggle("dark", next === "dark");
    setTheme(next);
  }

  return (
    <div className="inline-flex overflow-hidden rounded-control border border-line" role="group">
      <button
        type="button"
        aria-pressed={theme === "light"}
        onClick={() => apply("light")}
        className={`min-h-12 min-w-12 px-4 text-label font-ui transition-colors ${
          theme === "light" ? "bg-action-dim text-action" : "bg-surface text-ink-soft"
        }`}
      >
        Light
      </button>
      <button
        type="button"
        aria-pressed={theme === "dark"}
        onClick={() => apply("dark")}
        className={`min-h-12 min-w-12 border-l border-line px-4 text-label font-ui transition-colors ${
          theme === "dark" ? "bg-action-dim text-action" : "bg-surface text-ink-soft"
        }`}
      >
        Dark
      </button>
    </div>
  );
}
