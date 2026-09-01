import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { THEME_COOKIE, isTheme, type Theme } from "@/lib/theme";
import { FacilitatorShell } from "@/components/facilitator/facilitator-shell";
import { getCurrentRole, getSignedOutReason } from "@/lib/auth/roles";

// Real segment (not a route group) since /facilitator is an actual URL
// prefix here, unlike (caregiver)'s / or (applicant)'s /status.
//
// L5: this route had no auth gate at all before this session - anyone
// could load it. Wiring real per-facilitator schedule/session data
// through these screens makes that a real access-control gap, not just
// a cosmetic one. Two distinct failure modes, handled differently: no
// session at all (or an expired one) redirects to sign-in, same as
// (caregiver); a real, currently-signed-in member or admin hitting this
// URL is not "signed out" - redirecting them to sign-in would just
// bounce them straight back in a loop - so that case renders as
// not-found instead, the same "don't confirm this route exists to a
// role that will never have a reason to see it" treatment admin routes
// give an unpermitted role.
export default async function FacilitatorLayout({ children }: { children: React.ReactNode }) {
  const role = await getCurrentRole();
  if (role === null) {
    const reason = await getSignedOutReason();
    redirect(reason === "session_expired" ? "/sign-in?error=session_expired" : "/sign-in");
  }
  if (role !== "facilitator") notFound();

  const cookieStore = await cookies();
  const cookieTheme = cookieStore.get(THEME_COOKIE)?.value;
  const theme: Theme = isTheme(cookieTheme) ? cookieTheme : "light";

  return <FacilitatorShell theme={theme}>{children}</FacilitatorShell>;
}
