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

/** Three-state attendance mark plus the explicit "not yet marked" state — never implied by a default. */
export type AttendanceStatus = "present" | "absent" | "excused" | "unmarked";

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
  /**
   * Where "Join by video" points. Null when there's nothing to join — a past
   * session, or an upcoming one whose link the facilitator hasn't shared yet.
   * Video calling is a link out, never built in (Part 5.3).
   */
  joinUrl: string | null;
  materialsCount: number;
  /** Set on upcoming sessions; attendance isn't final yet. */
  attendingCount?: number;
  /** Set on past sessions. */
  attendance?: SessionAttendance;
  /** Facilitator log: per-member attendance, keyed by CohortMember id. Absent (undefined) means every member starts unmarked. */
  attendanceByMember?: Record<string, AttendanceStatus>;
  /** Facilitator log: free-text notes as last submitted. Undefined until a log is submitted. */
  notes?: string;
  /** Facilitator log: whether "confirm this session took place" has been checked and submitted. */
  deliveryConfirmed?: boolean;
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
