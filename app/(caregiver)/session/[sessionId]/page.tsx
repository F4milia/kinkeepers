import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { DevViewSwitcher } from "@/components/dev-view-switcher";
import { FacilitatorSessionLog } from "@/components/facilitator/session-log";
import { SessionDetail } from "@/components/session/session-detail";
import { getCohortMembersForFacilitator, getSession } from "@/lib/data";
import { getCurrentRole } from "@/lib/auth/roles";
import { DEV_VIEW_COOKIE, isDevView, type DevView } from "@/lib/dev-view";
import type { Session } from "@/lib/types";

// /session/[sessionId] | Part 3.4. One route, two roles.
//
// X4: this used to decide caregiver-vs-facilitator purely from the dev
// cookie, a leftover from before real auth existed - meaning a real,
// signed-in facilitator clicking "needs a log" from /facilitator would
// see the plain member view instead of their own log screen. The
// signed-in user's real role is now the primary decision; the dev cookie
// only overrides it outside production, for manual testing convenience,
// same guard as the /components dev gallery.
export default async function SessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const session = await getSession(sessionId);
  if (!session) notFound();

  const role = await getCurrentRole();
  let view: DevView = role === "facilitator" ? "facilitator" : "caregiver";

  const isDev = process.env.NODE_ENV !== "production";
  if (isDev) {
    const cookieStore = await cookies();
    const cookieDevView = cookieStore.get(DEV_VIEW_COOKIE)?.value;
    if (isDevView(cookieDevView)) view = cookieDevView;
  }

  return (
    <div className="flex flex-col gap-section">
      {isDev && <DevViewSwitcher initialView={view} />}
      {view === "facilitator" ? (
        <FacilitatorView session={session} />
      ) : (
        <SessionDetail session={session} />
      )}
    </div>
  );
}

async function FacilitatorView({ session }: { session: Session }) {
  const members = await getCohortMembersForFacilitator(session.cohortId);
  // No facilitator display name exists anywhere in the schema yet (see
  // lib/data.ts's own header comment) - the log screen's "Logged by X"
  // banner simply doesn't render rather than showing a fabricated name.
  return <FacilitatorSessionLog session={session} members={members} facilitatorName="" />;
}
