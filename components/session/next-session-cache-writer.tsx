"use client";

import { useEffect } from "react";
import { writeNextSessionCache, type CachedNextSession } from "@/components/session/next-session-cache";

/** Invisible - mounted alongside the real next-meeting card purely to keep its offline cache warm. */
export function NextSessionCacheWriter({ session }: { session: CachedNextSession }) {
  useEffect(() => {
    writeNextSessionCache(session);
    // Only the identifying fields need to trigger a re-write - a
    // re-render with the same session shouldn't touch storage every time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.date, session.time, session.joinUrl]);

  return null;
}
