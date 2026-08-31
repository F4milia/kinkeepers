import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { THEME_COOKIE, isTheme, type Theme } from "@/lib/theme";
import { AppShell } from "@/components/app-shell";
import { getCurrentRole } from "@/lib/auth/roles";

// The caregiver shell (bottom tab bar, 620px max-width, single column) -
// split out from the root layout so /admin (A1) can carry a different
// shell entirely, per its stated density exemption. Route groups don't
// affect the URL - / still serves from app/(caregiver)/page.tsx - this
// only changes which layout wraps which pages.
//
// L1: every route in this group now requires a real signed-in session -
// getCurrentRole() resolves role/session server-side from the database
// (never a client claim, per CLAUDE.md invariant #9); null means signed
// out. The fixture data these screens render is still the same generic
// content for everyone regardless of who signs in (L5, Wave 8, wires real
// per-member data) - this gate only decides whether you get in the door.
export default async function CaregiverLayout({ children }: { children: React.ReactNode }) {
  const role = await getCurrentRole();
  if (!role) redirect("/sign-in");

  const cookieStore = await cookies();
  const cookieTheme = cookieStore.get(THEME_COOKIE)?.value;
  const theme: Theme = isTheme(cookieTheme) ? cookieTheme : "light";

  return <AppShell theme={theme}>{children}</AppShell>;
}
