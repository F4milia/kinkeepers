import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { FacilitatorSessionLog } from "@/components/facilitator/session-log";
import { SessionDetail } from "@/components/session/session-detail";
import { getCohortMembers, getFacilitator, getSession, getViewer } from "@/lib/data";
import { DEV_VIEW_COOKIE, isDevView, type DevView } from "@/lib/dev-view";

// /session/[sessionId] | Part 3.4. One route, two roles: the dev view
// switcher (AppShell) decides which of these renders — the caregiver
// detail screen, or the facilitator's log for that same session.
export default async function SessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const session = getSession(sessionId);
  if (!session) notFound();

  const cookieStore = await cookies();
  const cookieDevView = cookieStore.get(DEV_VIEW_COOKIE)?.value;
  const view: DevView = isDevView(cookieDevView) ? cookieDevView : "caregiver";

  if (view === "facilitator") {
    const viewer = getViewer();
    const facilitator = getFacilitator(viewer.cohortId);
    if (!facilitator) notFound();
    const members = getCohortMembers(viewer.cohortId);
    return <FacilitatorSessionLog session={session} members={members} facilitatorName={facilitator.firstName} />;
  }

  return <SessionDetail session={session} />;
}
