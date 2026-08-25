import { ThemeToggle } from "@/components/theme-toggle";
import { cookies } from "next/headers";
import { isTheme, type Theme } from "@/lib/theme";
import { THEME_COOKIE } from "@/lib/theme";

const colorTokens = [
  "ink",
  "ink-soft",
  "canvas",
  "surface",
  "line",
  "action",
  "action-dim",
  "urgent",
  "gentle",
] as const;

/**
 * Scaffold verification only — this is not the Home screen. Part 4, Session
 * 0 explicitly says not to build screens yet. This page exists so
 * `npm run build` + a manual look confirms fonts, type tokens, and dark
 * mode are wired correctly before any screen gets built on top of them.
 */
export default async function TokenCheckPage() {
  const cookieStore = await cookies();
  const cookieTheme = cookieStore.get(THEME_COOKIE)?.value;
  const initialTheme: Theme = isTheme(cookieTheme) ? cookieTheme : "light";

  return (
    <main className="mx-auto max-w-content px-4 py-section">
      <div className="flex items-center justify-between gap-4">
        <p className="text-meta text-ink-soft font-ui">Scaffold check — not a screen</p>
        <ThemeToggle initialTheme={initialTheme} />
      </div>

      <h1 className="mt-section">Heading in Source Serif 4</h1>
      <p className="mt-4 text-body font-ui">
        This paragraph is Atkinson Hyperlegible Next at 18px, the body base size, with the 1.7
        line height specified for tired and aging readers.
      </p>

      <h2 className="mt-section">Type scale</h2>
      <div className="mt-4 flex flex-col gap-4">
        <p className="text-h1 font-heading">H1 — text-h1 / font-heading</p>
        <p className="text-h2 font-heading">H2 — text-h2 / font-heading</p>
        <p className="text-h3 font-heading">H3 — text-h3 / font-heading</p>
        <p className="text-body-lg font-ui">Body large — text-body-lg / font-ui</p>
        <p className="text-body font-ui">Body — text-body / font-ui</p>
        <p className="text-label font-ui">Label — text-label / font-ui</p>
        <p className="text-meta font-ui">Meta — text-meta / font-ui</p>
      </div>

      <h2 className="mt-section">Color tokens</h2>
      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
        {colorTokens.map((token) => (
          <div key={token} className="rounded-card border border-line bg-surface">
            <div className="h-16 rounded-t-card" style={{ background: `var(--${token})` }} />
            <p className="p-2 text-meta font-ui text-ink-soft">--{token}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
