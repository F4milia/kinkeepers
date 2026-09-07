import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { pingFunction } from "@/lib/inngest/functions/ping";
import { sessionRemindersFunction } from "@/lib/inngest/functions/session-reminders";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [pingFunction, sessionRemindersFunction],
});
