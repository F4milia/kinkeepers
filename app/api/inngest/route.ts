import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { pingFunction } from "@/lib/inngest/functions/ping";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [pingFunction],
});
