import { cookies } from "next/headers";
import { THEME_COOKIE, isTheme, type Theme } from "@/lib/theme";
import { AppShell } from "@/components/app-shell";

// The caregiver shell (bottom tab bar, 620px max-width, single column) -
// split out from the root layout so /admin (A1) can carry a different
// shell entirely, per its stated density exemption. Route groups don't
// affect the URL - / still serves from app/(caregiver)/page.tsx - this
// only changes which layout wraps which pages.
export default async function CaregiverLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const cookieTheme = cookieStore.get(THEME_COOKIE)?.value;
  const theme: Theme = isTheme(cookieTheme) ? cookieTheme : "light";

  return <AppShell theme={theme}>{children}</AppShell>;
}
