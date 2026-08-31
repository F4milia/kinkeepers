import { cookies } from "next/headers";
import { THEME_COOKIE, isTheme, type Theme } from "@/lib/theme";
import { FacilitatorShell } from "@/components/facilitator/facilitator-shell";

// Real segment (not a route group) since /facilitator is an actual URL
// prefix here, unlike (caregiver)'s / or (applicant)'s /status.
export default async function FacilitatorLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const cookieTheme = cookieStore.get(THEME_COOKIE)?.value;
  const theme: Theme = isTheme(cookieTheme) ? cookieTheme : "light";

  return <FacilitatorShell theme={theme}>{children}</FacilitatorShell>;
}
