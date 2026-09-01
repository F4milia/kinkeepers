/**
 * Shared response-shape types for the member/facilitator-facing app.
 * Originally modeled fixture data (lib/fixtures/); moved here in L5 when
 * lib/data.ts switched to real endpoints, since lib/data.ts and every
 * component that consumes it needs these shapes with zero dependency on
 * lib/fixtures (which is test-only from L5 onward). lib/fixtures/types.ts
 * re-exports from here so the mock data in lib/fixtures/data.ts keeps
 * working unchanged for tests.
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
  /**
   * Empty string means "not yet available" - currently only true for a
   * facilitator roster row (profiles has no name/bio column at all; see
   * CLAUDE.md's L5 session notes). Every real member row always has a
   * real first name, since applicants.first_name backs it directly.
   */
  firstName: string;
  /** Exact phrase for the `cohort.caring_for` template, e.g. "her husband". Empty for a facilitator row. */
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

/**
 * Only the three statuses L4 has a screen for. P2's applicant_status enum
 * also has referred, intake_complete, attending, declined, and withdrawn —
 * "attending" moves someone into the normal caregiver app (no dedicated L4
 * screen), and the other three don't reach the applicant-facing UI at all.
 */
export type ApplicantStatus = "pending_review" | "enrolled" | "completed";

export interface AssignedSession {
  date: string;
  time: string;
  timeZoneLabel: string;
  joinUrl: string | null;
  dialInNumber: string;
  dialInPin: string;
  facilitatorFirstName: string;
}

export interface Applicant {
  id: string;
  firstName: string;
  status: ApplicantStatus;
  /**
   * Only meaningful when status is "pending_review". P2's schema has one
   * status for both "just applied" and "waiting, no cohort fits yet" —
   * applicant_waitlist_summary is keyed off pending_review alone — so this
   * is a UI-only distinction pending L5's real matching signal.
   */
  hasMatchingCohort?: boolean;
  /** Same phrasing convention as Cohort.grouping, e.g. "spouses caring for a partner in early-stage dementia". */
  waitlistGroupingLabel?: string;
  /** e.g. "evenings Eastern" — the cadence/timezone half of the waitlisted sentence. */
  meetingTimeLabel?: string;
  assignedSession?: AssignedSession;
  completedProgramName?: string;
}
