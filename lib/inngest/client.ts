import { Inngest } from "inngest";

// CLAUDE.md's locked stack names Inngest for jobs - this is that wiring,
// previously entirely absent (no package, no route, no config). P4 PR3
// adds the first real function (session reschedule/cancellation
// notifications); everything after that registers here too.
export const inngest = new Inngest({ id: "kinkeepers" });
