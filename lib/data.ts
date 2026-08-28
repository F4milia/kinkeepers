/**
 * Data access layer. Every screen reads through these functions, never
 * through lib/fixtures directly. They currently read the typed fixtures;
 * swapping to a real API means changing the bodies of these functions and
 * nothing else.
 */

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
