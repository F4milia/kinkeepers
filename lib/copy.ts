/**
 * Copy deck — kinkeepers-frontend-build.md Part 3.1, transcribed verbatim.
 * Components and screens read strings from here, never inline literals.
 * If a string isn't here, it isn't cleared for use — see CLAUDE.md
 * "No invented copy."
 */

export const COPY = {
  nav: {
    home: "Home",
    cohort: "My group",
    discussion: "Discussion",
    support: "Get help now",
  },
  home: {
    greeting: "Hello, {firstName}",
    next_meetup: "Your next meeting",
    join_video: "Join by video",
    get_directions: "Get directions",
    cant_attend: "Let your group know you can't make it",
    progress: "Session {n} of {total}",
    recent: "Recent from your group",
    view_all: "See all discussion",
    empty_meetup: "No meetings scheduled yet. Your facilitator will add the next one.",
    empty_posts: "No one has posted this week.",
  },
  support: {
    title: "Get help now",
    body: "Someone from the care team is available any time, day or night. Call and a person will answer.",
    call: "Call {phoneNumber}",
    /** 555-01XX is reserved for fictional use — a demo tap can't reach a real person. */
    phoneNumber: "1-800-555-0142",
    note: "If this is a medical emergency, call 911.",
    close: "Close",
  },
  cohort: {
    title: "My group",
    subtitle: "{n} people, meeting {cadence}",
    facilitator_label: "Facilitator",
    caring_for: "Caring for {relationship}",
    empty: "Your group is still forming.",
  },
  discussion: {
    title: "Discussion",
    compose_placeholder: "Share something with your group",
    post: "Post",
    reply: "Reply",
    reply_placeholder: "Write a reply",
    draft_saved: "Draft saved",
    empty: "No posts yet. You can be the first.",
    replies_one: "1 reply",
    replies_many: "{n} replies",
  },
  session: {
    attending: "{n} people attending",
    topic: "What we'll cover",
    materials: "Materials",
    mark_absent: "I can't make this one",
    marked_absent: "You've let your group know you can't attend.",
    undo_absent: "Actually, I can attend",
    past_notes: "What we covered",
    location_video: "By video",
    location_person: "In person",
  },
  log: {
    title: "Session log",
    confirm_delivery: "Confirm this session took place",
    attendance: "Attendance",
    present: "Present",
    absent: "Absent",
    excused: "Excused",
    unmarked: "Not marked",
    notes: "Session notes",
    notes_placeholder: "What was covered, and anything the care team should know",
    submit: "Submit log",
    confirm_title: "Submit this session log?",
    confirm_body: "This becomes part of the service record. You can edit it later, and edits are recorded.",
    confirm_yes: "Submit log",
    confirm_cancel: "Keep editing",
    submitted_by: "Logged by {name} on {date}",
    edited_by: "Edited by {name} on {date}",
    previous_value: "Previously: {value}",
    unmarked_warning: "{n} people are not marked.",
  },
  error: {
    required: "This can't be empty.",
    too_long: "This is too long. Try shortening it.",
    load_failed: "We couldn't load this. Try again.",
    retry: "Try again",
  },
  loading: "Loading…",
  theme: {
    light: "Light",
    dark: "Dark",
  },
  /**
   * L4 (waitlist and program states). Literal strings are quoted directly
   * from the L4 session prompt where it gave them. Where it didn't
   * (assigned.what_to_expect, complete.body_no_next), the run doc and
   * Part 1.2 both require asking rather than inventing — these were
   * confirmed with Ferenz before being added here, not drafted solo.
   *
   * complete.body_with_next (the "if there's a next program, offer it"
   * branch) is NOT here yet — that copy hasn't been confirmed, so L4 only
   * builds the no-next-program case for now.
   */
  applicant: {
    waiting_review: {
      headline: "We're finding your group",
      body: "We have your information and we're finding the right group for you.",
    },
    waitlisted: {
      headline: "You're on the list",
      body: "We don't have a group that fits you yet. We're looking for {grouping}, meeting {meetingTime}.",
    },
    assigned: {
      headline: "Your first session",
      facilitator_label: "Facilitator",
      dial_in_label: "Or call in",
      what_to_expect: "Sessions run about 90 minutes. You can turn your camera off if you'd rather just listen. There's no wrong way to take part.",
    },
    complete: {
      headline: "You've completed the program",
      body_no_next: "You've completed {program}. There's no other program open for you right now. If that changes, we'll reach out.",
    },
  },
} as const;

/** Fills `{key}` placeholders in a copy string, e.g. format(COPY.home.greeting, { firstName: "Denise" }). */
export function format(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    const value = values[key];
    return value === undefined ? match : String(value);
  });
}
