"use client";

/**
 * Offline support for the Home screen's next-meeting card (L5's "assume
 * rural broadband and old devices... cache the next session details so a
 * member with a flaky connection can still see when and where to join").
 *
 * Plain localStorage, not a runtime capability - this is a per-device
 * convenience for one member's own next session, never shared and never
 * something the server needs to read back. Wrapped in try/catch per this
 * codebase's own established caution: a private window, cleared site
 * data, or a browser that blocks storage must not crash the page over a
 * cache that's allowed to simply not exist.
 */

const CACHE_KEY = "kk_next_session_cache";

export interface CachedNextSession {
  date: string;
  time: string;
  timeZoneLabel: string;
  joinUrl: string | null;
  deliveryFormat: "video" | "in_person";
  sessionNumber: number;
  sessionTotal: number;
}

export function writeNextSessionCache(session: CachedNextSession): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(session));
  } catch {
    // Storage unavailable - the cache is a convenience, not a requirement.
  }
}

export function readNextSessionCache(): CachedNextSession | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as CachedNextSession) : null;
  } catch {
    return null;
  }
}
