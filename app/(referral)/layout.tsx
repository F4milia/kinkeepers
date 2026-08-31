import { cookies } from "next/headers";
import { THEME_COOKIE, isTheme, type Theme } from "@/lib/theme";
import { ApplicantShell } from "@/components/applicant-shell";

// L2 (referral landing + intake) - unauthenticated by design, same
// minimal shell as (applicant)'s status screens: theme toggle + support
// affordance, no nav. Covers both /refer/[slug] and /intake/*.
export default async function ReferralLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const cookieTheme = cookieStore.get(THEME_COOKIE)?.value;
  const theme: Theme = isTheme(cookieTheme) ? cookieTheme : "light";

  return <ApplicantShell theme={theme}>{children}</ApplicantShell>;
}
