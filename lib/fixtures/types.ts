/**
 * Fixture types. These model the eventual API response shapes — when the
 * backend lands, only lib/data.ts changes, not these types or the
 * components that consume them.
 */

export type DeliveryFormat = "video" | "in_person";

export type CohortStatus = "forming" | "active" | "completed";

export interface Cohort {
  id: string;
  name: string;
  grouping: string;
  program: string;
  cadence: string;
  timeZoneLabel: string;
  capacity: number;
  status: CohortStatus;
  sessionNumber: number;
  sessionTotal: number;
  deliveryFormat: DeliveryFormat;
}

export type MemberRole = "member" | "facilitator";

export interface CohortMember {
  id: string;
  cohortId: string;
  firstName: string;
  /** Exact phrase for the `cohort.caring_for` template, e.g. "her husband". */
  caringFor: string;
  role: MemberRole;
}

export type Facilitator = CohortMember & { role: "facilitator" };

export type SessionStatus = "upcoming" | "past";

export interface SessionAttendance {
  present: number;
  absent: number;
  excused: number;
}

export interface Session {
  id: string;
  cohortId: string;
  sessionNumber: number;
  sessionTotal: number;
  status: SessionStatus;
  /** ISO 8601 date (no time) the session falls on. */
  date: string;
  /** Local start time as scheduled, e.g. "6:30 PM". */
  time: string;
  timeZoneLabel: string;
  durationMinutes: number;
  deliveryFormat: DeliveryFormat;
  /**
   * Tele-Savvy session topics come from licensed curriculum materials.
   * Left null until the license is confirmed and topics are cleared to
   * display — see kinkeepers-frontend-build.md Part 3.2.
   */
  topic: string | null;
  materialsCount: number;
  /** Set on upcoming sessions; attendance isn't final yet. */
  attendingCount?: number;
  /** Set on past sessions. */
  attendance?: SessionAttendance;
  loggedBy?: string;
  loggedDate?: string;
}

export interface PostReply {
  id: string;
  postId: string;
  authorFirstName: string;
  authorRole: MemberRole;
  body: string;
  createdAt: string;
}

export interface Post {
  id: string;
  cohortId: string;
  authorFirstName: string;
  authorRole: MemberRole;
  body: string;
  createdAt: string;
  replies: PostReply[];
}
