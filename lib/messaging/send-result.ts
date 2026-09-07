/**
 * Shared between send-email.ts and send-sms.ts (2026-09-08 A5
 * gap-closure) - both used to return a plain boolean, discarding the
 * real failure reason right after logging it. A5's own prompt text
 * ("Failed sends from P4: member, session, channel, error") needs that
 * reason to actually reach notification_log.error_message, so the
 * caller has to be able to see it too.
 */
export type SendResult = { sent: true } | { sent: false; error: string };
