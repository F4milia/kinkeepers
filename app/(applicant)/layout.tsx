import { cookies } from "next/headers";
import { THEME_COOKIE, isTheme, type Theme } from "@/lib/theme";
import { ApplicantShell } from "@/components/applicant-shell";

// Split from the caregiver layout the same way /admin is (A1) — this route
// group needs its own shell (no TabBar; see applicant-shell.tsx).
export default async function ApplicantLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const cookieTheme = cookieStore.get(THEME_COOKIE)?.value;
  const theme: Theme = isTheme(cookieTheme) ? cookieTheme : "light";

  return <ApplicantShell theme={theme}>{children}</ApplicantShell>;
}
