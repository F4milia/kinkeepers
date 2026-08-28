/**
 * Data access layer. Every screen reads through these functions, never
 * through lib/fixtures directly. They currently read the typed fixtures;
 * swapping to a real API means changing the bodies of these functions and
 * nothing else.
 */

import { parseTimeLabel } from "./format-date";
import {
  applicants,
  cohortMembers,
  cohorts,
  posts,
  sessions,
  type Applicant,
  type Cohort,
  type CohortMember,
  type Facilitator,
  type Post,
  type Session,
} from "./fixtures";

/** The signed-in caregiver Home and other member-facing screens render from — a member, not the facilitator. */
const VIEWER_MEMBER_ID = "member-002";

export function getViewer(): CohortMember {
  const viewer = cohortMembers.find((member) => member.id === VIEWER_MEMBER_ID);
  if (!viewer) throw new Error(`Viewer fixture ${VIEWER_MEMBER_ID} not found`);
  return viewer;
}

/**
 * Denise, across both cohorts she facilitates. Two ids because
 * CohortMember rows are cohort-scoped (F1) — there's no cross-cohort
 * identity in the fixture model, so "the same facilitator runs both" is
 * expressed as membership in this list rather than a shared field.
 */
const FACILITATOR_VIEWER_MEMBER_IDS = ["member-001", "member-011"];

export function getFacilitatorViewer(): Facilitator {
  const facilitator = cohortMembers.find(
    (member): member is Facilitator =>
      member.role === "facilitator" && FACILITATOR_VIEWER_MEMBER_IDS.includes(member.id),
  );
  if (!facilitator) throw new Error("Facilitator viewer fixture not found");
  return facilitator;
}

export function getFacilitatorCohorts(): Cohort[] {
  const cohortIds = cohortMembers
    .filter((member) => FACILITATOR_VIEWER_MEMBER_IDS.includes(member.id))
    .map((member) => member.cohortId);
  return cohorts.filter((cohort) => cohortIds.includes(cohort.id));
}

function sessionStartEndMinutes(session: Session): { start: number; end: number } {
  const { hours, minutes } = parseTimeLabel(session.time);
  const start = hours * 60 + minutes;
  return { start, end: start + session.durationMinutes };
}

function sessionsOverlap(a: Session, b: Session): boolean {
  if (a.date !== b.date) return false;
  const rangeA = sessionStartEndMinutes(a);
  const rangeB = sessionStartEndMinutes(b);
  return rangeA.start < rangeB.end && rangeB.start < rangeA.end;
}

/** Every session across the facilitator's cohorts, chronological — F1's schedule spans all cohorts, not one at a time. */
export function getFacilitatorSessions(): Session[] {
  const cohortIds = getFacilitatorCohorts().map((cohort) => cohort.id);
  return sessions
    .filter((session) => cohortIds.includes(session.cohortId))
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return sessionStartEndMinutes(a).start - sessionStartEndMinutes(b).start;
    });
}

export interface FacilitatorScheduleSession extends Session {
  /** ids of other facilitator sessions this one overlaps in time — F1's "collisions" flag. */
  overlapsSessionIds: string[];
}

export function getFacilitatorSchedule(): FacilitatorScheduleSession[] {
  const facilitatorSessions = getFacilitatorSessions();
  return facilitatorSessions.map((session) => ({
    ...session,
    overlapsSessionIds: facilitatorSessions
      .filter((other) => other.id !== session.id && sessionsOverlap(session, other))
      .map((other) => other.id),
  }));
}

export function getNextFacilitatorSession(): Session | undefined {
  return getFacilitatorSessions().find((session) => session.status === "upcoming");
}

/** Past sessions with no delivery confirmation yet — the nudge F1's home screen leads with. */
export function getFacilitatorSessionsNeedingLog(): Session[] {
  return getFacilitatorSessions().filter((session) => session.status === "past" && !session.deliveryConfirmed);
}

export function getCohort(cohortId: string): Cohort | undefined {
  return cohorts.find((cohort) => cohort.id === cohortId);
}

export function getCohortMembers(cohortId: string): CohortMember[] {
  return cohortMembers.filter((member) => member.cohortId === cohortId);
}

export function getFacilitator(cohortId: string): Facilitator | undefined {
  return getCohortMembers(cohortId).find(
    (member): member is Facilitator => member.role === "facilitator",
  );
}

export function getSessions(cohortId: string): Session[] {
  return sessions
    .filter((session) => session.cohortId === cohortId)
    .sort((a, b) => a.sessionNumber - b.sessionNumber);
}

export function getUpcomingSession(cohortId: string): Session | undefined {
  return getSessions(cohortId).find((session) => session.status === "upcoming");
}

export function getSession(sessionId: string): Session | undefined {
  return sessions.find((session) => session.id === sessionId);
}

export function getPosts(cohortId: string): Post[] {
  return posts
    .filter((post) => post.cohortId === cohortId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function getApplicant(applicantId: string): Applicant | undefined {
  return applicants.find((applicant) => applicant.id === applicantId);
}
