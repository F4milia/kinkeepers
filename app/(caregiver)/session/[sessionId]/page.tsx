import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { DevViewSwitcher } from "@/components/dev-view-switcher";
import { FacilitatorSessionLog } from "@/components/facilitator/session-log";
import { SessionDetail } from "@/components/session/session-detail";
import { getCohortMembers, getFacilitator, getSession, getViewer } from "@/lib/data";
import { DEV_VIEW_COOKIE, isDevView, type DevView } from "@/lib/dev-view";
import type { Session } from "@/lib/fixtures";

// /session/[sessionId] | Part 3.4. One route, two roles: the dev view
// switcher decides which of these renders — the caregiver detail screen, or
// the facilitator's log for that same session. The switcher lives here
// rather than in AppShell because this is the only route it affects.
export default async function SessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const session = getSession(sessionId);
  if (!session) notFound();

  const cookieStore = await cookies();
  const cookieDevView = cookieStore.get(DEV_VIEW_COOKIE)?.value;
  const view: DevView = isDevView(cookieDevView) ? cookieDevView : "caregiver";

  return (
    <div className="flex flex-col gap-section">
      <DevViewSwitcher initialView={view} />
      {view === "facilitator" ? (
        <FacilitatorView session={session} />
      ) : (
        <SessionDetail session={session} />
      )}
    </div>
  );
}

function FacilitatorView({ session }: { session: Session }) {
  const viewer = getViewer();
  const facilitator = getFacilitator(viewer.cohortId);
  if (!facilitator) notFound();
  const members = getCohortMembers(viewer.cohortId);
  return <FacilitatorSessionLog session={session} members={members} facilitatorName={facilitator.firstName} />;
}
