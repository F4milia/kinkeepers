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
  /**
   * F1 (facilitator home and schedule). Unlike L4, the F1 prompt quoted no
   * literal copy at all — every string here was drafted and confirmed with
   * Ferenz first, per Part 1.2's "ask, don't invent" rule. Plain functional
   * labels (nav.home, nav.schedule, cohorts.title) follow the same
   * low-risk precedent as existing structural titles like
   * COPY.discussion.title.
   */
  facilitator: {
    nav: {
      home: "Home",
      schedule: "Schedule",
    },
    home: {
      // L5: no facilitator display name exists anywhere in the schema
      // yet (profiles has no name column) - confirmed with Ferenz as
      // part of this session's own scope decisions. Used only when
      // getFacilitatorViewer() has no real name to fill into
      // COPY.home.greeting's template.
      greeting_generic: "Hello",
      next_session: "Your next session",
      needs_log: "Needs a log",
      cohorts_title: "Your cohorts",
      empty_next_session: "No upcoming sessions scheduled.",
      empty_needs_log: "Nothing waiting on a log.",
    },
    schedule: {
      title: "Schedule",
      upcoming: "Upcoming",
      past: "Past",
      logged: "Logged",
      // Two strings, not one with plural syntax — format() is a plain
      // {key} substitution, not an ICU MessageFormat parser (same reason
      // COPY.discussion.replies_one/replies_many are split).
      not_logged_one: "Not logged — 1 day overdue",
      not_logged_many: "Not logged — {n} days overdue",
      overlaps_with: "Overlaps with {cohortName}",
      empty: "No sessions scheduled yet.",
    },
  },
  /**
   * L1 (sign-in), amended per Ferenz's direct instruction: email only for
   * now, SMS deferred until Twilio is configured — CLAUDE.md's "magic link
   * + SMS code" invariant names the intended two methods, not a
   * requirement that both be simultaneously live; SMS genuinely cannot
   * function without real Twilio credentials, same credential-gap
   * treatment already given to Zoom/Sentry elsewhere in this codebase.
   *
   * sent_body and error_rate_limited are quoted directly from the L1
   * prompt. error_link_invalid was confirmed with Ferenz first (no
   * literal text given for that case). Everything else is a plain
   * functional label, same low-risk precedent as existing structural
   * titles/button verbs (COPY.log.submit, COPY.discussion.post).
   */
  sign_in: {
    title: "Sign in",
    email_label: "Email",
    send_link: "Send link",
    sent_body: "We sent a link to {email}. Open it on this device if you can.",
    resend: "Resend link",
    resend_countdown: "You can resend in {n}s",
    error_invalid_email: "Enter a valid email address.",
    error_rate_limited: "Too many tries. Wait a few minutes, or call us at {phoneNumber}.",
    error_send_failed: "We couldn't send that. Try again.",
    error_link_invalid: "That link has expired or was already used. Send a new one below.",
  },
  /**
   * L2 (referral landing and intake). Several strings are quoted directly
   * from the L2 prompt (start, referred_by, step_indicator, saved,
   * stage_unsure, confirmation.body). Two were confirmed with Ferenz
   * first, since the prompt only described the requirement, not literal
   * text: landing.blurb (the "what KinKeepers is, four sentences"
   * description) and invalid_link. Field labels are plain functional
   * labels, same low-risk precedent as L1's email_label.
   */
  referral: {
    landing: {
      blurb:
        "KinKeepers is a small group for people caring for someone with dementia. You meet with the same six to twelve people every week, by video, with a facilitator who's been trained to lead the group. It's a place to talk about what caregiving is actually like, with people who understand. What's said in the group stays in the group.",
      referred_by: "Referred by {name}",
      start: "Start",
      invalid_link: "This link isn't working. Call us at {phoneNumber} and we can help you get started.",
    },
    step_indicator: "Step {n} of 3",
    saved: "We saved your answers.",
    back: "Back",
    next: "Continue",
    field: {
      first_name: "First name",
      last_name: "Last name",
      email: "Email",
      phone: "Phone",
      time_zone: "Time zone",
      relationship: "Your relationship to the person you care for",
      stage: "Their stage",
      stage_unsure: "I'm not sure",
      availability: "When are you usually free to meet?",
      contact_preference: "How should we reach you?",
      contact_email: "Email",
      contact_sms: "Text",
      contact_both: "Either",
    },
    availability_option: {
      weekday_mornings: "Weekday mornings",
      weekday_afternoons: "Weekday afternoons",
      weekday_evenings: "Weekday evenings",
      weekends: "Weekends",
    },
    confirmation: {
      body: "We have your information. Someone will reach out within three business days.",
    },
  },
  /**
   * L3, consent section only (notification preferences and account info
   * deferred - see CLAUDE.md/session notes on the missing profiles<->
   * applicants link). Document type names are plain factual labels, not
   * invented copy - they name what the document already is. checkbox/
   * agree/continue are functional verbs, same precedent as L1/L2. The
   * group-confidentiality intro was confirmed with Ferenz first, since
   * the prompt only described the tone it needed ("a commitment to the
   * group, not a legal formality"), not literal text.
   */
  consent: {
    title: "Agreements",
    document_name: {
      terms_of_service: "Terms of Service",
      privacy_policy: "Privacy Policy",
      participant_agreement: "Participant Agreement",
      group_confidentiality: "Group Confidentiality Agreement",
    },
    group_confidentiality_intro:
      "Before your first session, there's one more agreement — this one made to your group, not to us. What people share here is theirs. Agreeing means you'll keep it that way, even after you leave the group.",
    checkbox_label: "I have read and agree to the {documentName}",
    agree: "Agree",
    consented_on: "Agreed {date}",
    all_done: "You're up to date on your agreements.",
    discussion_line: "What's shared here stays here.",
  },
  /**
   * L5 (API integration and error states). network.headline/body is
   * quoted directly from the L5 prompt ("We couldn't load this. Check
   * your connection and try again."). auth_expired, not_found, server,
   * and the two not-yet-available placeholders were confirmed with
   * Ferenz first - the prompt described what each state needs to do
   * ("a plain explanation," "explain what happened," "apologize once,
   * plainly") without giving literal text, and facilitator_not_yet_
   * available/discussion_not_yet_available cover two real schema gaps
   * (no facilitator name/bio column, no discussion board table) found
   * while scoping this session, also confirmed with Ferenz rather than
   * invented solo.
   */
  errors: {
    network: {
      headline: "We couldn't load this.",
      body: "Check your connection and try again.",
      retry: "Try again",
    },
    auth_expired: {
      headline: "You've been signed out",
      body: "Sign in again to keep going.",
      sign_in: "Sign in",
    },
    not_found: {
      headline: "We couldn't find that.",
      body: "It may have moved, or the link may be out of date.",
      go_home: "Go to Home",
    },
    server: {
      headline: "Something went wrong on our end.",
      body: "We're sorry. Call us if this keeps happening.",
    },
    call_for_help: "Call {phoneNumber}",
    offline: {
      headline: "You're offline",
      body: "Showing what was last saved. Reconnect to see the latest.",
    },
    facilitator_not_yet_available:
      "Facilitator details aren't available here yet. Call us if you need to reach your facilitator.",
    discussion_not_yet_available: "Discussion isn't available here yet.",
  },
} as const;

/** Fills `{key}` placeholders in a copy string, e.g. format(COPY.home.greeting, { firstName: "Denise" }). */
export function format(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    const value = values[key];
    return value === undefined ? match : String(value);
  });
}
