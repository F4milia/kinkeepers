import type { Cohort, CohortMember, Post, Session } from "./types";

/**
 * All content below is fictional. No real person is depicted.
 * Populated from kinkeepers-frontend-build.md Part 3.2, exactly as written.
 */

export const cohorts: Cohort[] = [
  {
    id: "cohort-001",
    name: "Spouses, Early Stage — Tuesday Evenings",
    grouping: "Spouses caring for a partner in early-stage dementia",
    program: "Tele-Savvy",
    cadence: "every Tuesday",
    timeZoneLabel: "Eastern",
    capacity: 12,
    status: "active",
    sessionNumber: 4,
    sessionTotal: 6,
    deliveryFormat: "video",
  },
];

export const cohortMembers: CohortMember[] = [
  { id: "member-001", cohortId: "cohort-001", firstName: "Denise", caringFor: "her husband", role: "facilitator" },
  { id: "member-002", cohortId: "cohort-001", firstName: "Rosalind", caringFor: "her husband", role: "member" },
  { id: "member-003", cohortId: "cohort-001", firstName: "Terry", caringFor: "his wife", role: "member" },
  { id: "member-004", cohortId: "cohort-001", firstName: "Paul", caringFor: "his wife", role: "member" },
  { id: "member-005", cohortId: "cohort-001", firstName: "Hector", caringFor: "his wife", role: "member" },
  { id: "member-006", cohortId: "cohort-001", firstName: "Marilyn", caringFor: "her husband", role: "member" },
  { id: "member-007", cohortId: "cohort-001", firstName: "Curtis", caringFor: "his wife", role: "member" },
  { id: "member-008", cohortId: "cohort-001", firstName: "Yvonne", caringFor: "her husband", role: "member" },
  { id: "member-009", cohortId: "cohort-001", firstName: "Bernadette", caringFor: "her husband", role: "member" },
  { id: "member-010", cohortId: "cohort-001", firstName: "Arthur", caringFor: "his wife", role: "member" },
];

// Anchored to 2026-08-25 (a Tuesday). Cohort meets every Tuesday.
export const sessions: Session[] = [
  {
    id: "session-005",
    cohortId: "cohort-001",
    sessionNumber: 5,
    sessionTotal: 6,
    status: "upcoming",
    date: "2026-09-01",
    time: "6:30 PM",
    timeZoneLabel: "Eastern",
    durationMinutes: 120,
    deliveryFormat: "video",
    topic: null,
    materialsCount: 1,
    attendingCount: 7,
  },
  {
    id: "session-004",
    cohortId: "cohort-001",
    sessionNumber: 4,
    sessionTotal: 6,
    status: "past",
    date: "2026-08-18",
    time: "6:30 PM",
    timeZoneLabel: "Eastern",
    durationMinutes: 120,
    deliveryFormat: "video",
    topic: null,
    materialsCount: 0,
    attendance: { present: 8, absent: 1, excused: 1 },
    // Per-member marks consistent with the aggregate counts above — Part 3.2
    // gives only the totals, so this distribution is ours, not sourced content.
    attendanceByMember: {
      "member-001": "present", // Denise (facilitator)
      "member-002": "present", // Rosalind
      "member-003": "present", // Terry
      "member-004": "present", // Paul
      "member-005": "absent", // Hector
      "member-006": "present", // Marilyn
      "member-007": "excused", // Curtis
      "member-008": "present", // Yvonne
      "member-009": "present", // Bernadette
      "member-010": "present", // Arthur
    },
    deliveryConfirmed: true,
    loggedBy: "Denise",
    loggedDate: "2026-08-18",
  },
  {
    id: "session-003",
    cohortId: "cohort-001",
    sessionNumber: 3,
    sessionTotal: 6,
    status: "past",
    date: "2026-08-11",
    time: "6:30 PM",
    timeZoneLabel: "Eastern",
    durationMinutes: 120,
    deliveryFormat: "video",
    topic: null,
    materialsCount: 0,
    attendance: { present: 9, absent: 0, excused: 1 },
    attendanceByMember: {
      "member-001": "present", // Denise (facilitator)
      "member-002": "present", // Rosalind
      "member-003": "present", // Terry
      "member-004": "present", // Paul
      "member-005": "present", // Hector
      "member-006": "present", // Marilyn
      "member-007": "present", // Curtis
      "member-008": "excused", // Yvonne
      "member-009": "present", // Bernadette
      "member-010": "present", // Arthur
    },
    deliveryConfirmed: true,
    loggedBy: "Denise",
    loggedDate: "2026-08-11",
  },
];

export const posts: Post[] = [
  {
    id: "post-001",
    cohortId: "cohort-001",
    authorFirstName: "Rosalind",
    authorRole: "member",
    body: "He asked me who I was on Sunday. Not in a confused way, just plainly, like meeting someone. I said I was his wife and he said that was nice. I don't know what to do with that. I made dinner after and it was fine. That's the part nobody tells you, that it's fine after.",
    createdAt: "2026-08-23",
    replies: [
      {
        id: "reply-001",
        postId: "post-001",
        authorFirstName: "Terry",
        authorRole: "member",
        body: "The first time is the worst. It happened to me in March. It happens again and it doesn't get easier exactly but you get less surprised.",
        createdAt: "2026-08-23",
      },
      {
        id: "reply-002",
        postId: "post-001",
        authorFirstName: "Denise",
        authorRole: "facilitator",
        body: "Rosalind, thank you for putting that here. We're going to talk about this Tuesday — it's what week five is about. You don't have to have anything figured out before then.",
        createdAt: "2026-08-24",
      },
    ],
  },
  {
    id: "post-002",
    cohortId: "cohort-001",
    authorFirstName: "Terry",
    authorRole: "member",
    body: "Practical question. My wife has started refusing to shower. Not arguing, just won't. Her sister thinks I should insist. I don't want to force her and I also don't want her sitting in the same clothes for four days. Has anyone found something that works.",
    createdAt: "2026-08-21",
    replies: [
      {
        id: "reply-003",
        postId: "post-002",
        authorFirstName: "Marilyn",
        authorRole: "member",
        body: "We moved it to mornings and stopped calling it a shower. My husband will get in if I say we're getting ready for the day. Took a few weeks to land on that.",
        createdAt: "2026-08-21",
      },
      {
        id: "reply-004",
        postId: "post-002",
        authorFirstName: "Yvonne",
        authorRole: "member",
        body: "Warm the bathroom first. Mine was cold and couldn't say so.",
        createdAt: "2026-08-22",
      },
    ],
  },
  {
    id: "post-003",
    cohortId: "cohort-001",
    authorFirstName: "Paul",
    authorRole: "member",
    body: "I put her in respite for two days last week and I felt guilty the entire time. Slept eleven hours the first night. Not sure what I'm asking here.",
    createdAt: "2026-08-19",
    replies: [
      {
        id: "reply-005",
        postId: "post-003",
        authorFirstName: "Bernadette",
        authorRole: "member",
        body: "You're not asking anything. You're allowed to just say it.",
        createdAt: "2026-08-20",
      },
    ],
  },
];
