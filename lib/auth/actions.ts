"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { checkSignInRateLimit } from "@/lib/auth/rate-limit";
import { logSignInEvent } from "@/lib/auth/log-sign-in-event";

// A fixed NEXT_PUBLIC_SITE_URL can only ever point at one deployment,
// which breaks the magic-link redirect on every OTHER one - a preview
// deployment's own emailed link would still redirect back to whatever
// single URL that env var holds, landing on a domain that never had the
// PKCE verifier cookie the request set (cookies don't cross Vercel
// preview/production subdomains), so exchangeCodeForSession fails no
// matter how correct the code otherwise is. Deriving the origin from the
// actual incoming request instead means the redirect always matches
// wherever the request really came from - production, any preview, or
// local dev - with no per-environment configuration at all.
async function getRequestOrigin(): Promise<string> {
  const headersList = await headers();
  const host = headersList.get("host");
  const protocol = process.env.NODE_ENV === "development" ? "http" : "https";
  return `${protocol}://${host}`;
}

// E.164: + followed by 8-15 digits, first digit 1-9. Deliberately not a
// full phone-parsing library - callers (L1's sign-in form) are expected
// to collect and format the number before it reaches here.
const E164_PATTERN = /^\+[1-9]\d{7,14}$/;

export type SignInRequestResult =
  | { success: true }
  | { success: false; reason: "invalid_input" }
  | { success: false; reason: "rate_limited"; retryReason: "hourly" | "daily" }
  | { success: false; reason: "send_failed" };

export type VerifyResult =
  | { success: true }
  | { success: false; reason: "invalid_code" };

function normalizeEmail(email: string): string {
  // Trim + lowercase only. Deliberately NOT stripping +tags - a plus-tag
  // variant of an existing address (ivan+test@) is a distinct identifier
  // per the L1 named edge case, routed to intake like any other new
  // address rather than silently matched to the base address.
  return email.trim().toLowerCase();
}

export async function requestEmailLink(rawEmail: string): Promise<SignInRequestResult> {
  const email = normalizeEmail(rawEmail);
  if (!email || !email.includes("@")) {
    return { success: false, reason: "invalid_input" };
  }

  const rateLimit = await checkSignInRateLimit(email);
  if (!rateLimit.allowed) {
    await logSignInEvent(email, "email_link", "rate_limited");
    return { success: false, reason: "rate_limited", retryReason: rateLimit.retryReason };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${await getRequestOrigin()}/auth/callback`,
    },
  });

  if (error) {
    await logSignInEvent(email, "email_link", "failed");
    return { success: false, reason: "send_failed" };
  }

  await logSignInEvent(email, "email_link", "sent");
  return { success: true };
}

export async function requestSmsCode(rawPhone: string): Promise<SignInRequestResult> {
  const phone = rawPhone.trim();
  if (!E164_PATTERN.test(phone)) {
    return { success: false, reason: "invalid_input" };
  }

  const rateLimit = await checkSignInRateLimit(phone);
  if (!rateLimit.allowed) {
    await logSignInEvent(phone, "sms_code", "rate_limited");
    return { success: false, reason: "rate_limited", retryReason: rateLimit.retryReason };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({ phone });

  if (error) {
    await logSignInEvent(phone, "sms_code", "failed");
    return { success: false, reason: "send_failed" };
  }

  await logSignInEvent(phone, "sms_code", "sent");
  return { success: true };
}

export async function verifySmsCode(rawPhone: string, code: string): Promise<VerifyResult> {
  const phone = rawPhone.trim();
  const supabase = await createClient();

  const { error } = await supabase.auth.verifyOtp({
    phone,
    token: code,
    type: "sms",
  });

  if (error) {
    await logSignInEvent(phone, "sms_code", "failed");
    return { success: false, reason: "invalid_code" };
  }

  await logSignInEvent(phone, "sms_code", "verified");
  return { success: true };
}
