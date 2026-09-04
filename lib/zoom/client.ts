import "server-only";
import { logError } from "@/lib/log";

/**
 * Zoom Server-to-Server OAuth client. Holds account-wide meeting-management
 * credentials - never reachable from client code, never logged.
 *
 * This module has no APP_ENV branch the way lib/messaging/staging-guard.ts
 * does for Twilio/Resend, because there's no "recipient" here to allowlist -
 * a Zoom meeting isn't sent to a person, it's created on an account. That
 * part is still true. What's NOT true, corrected 2026-09-04 after this
 * comment was found to cite a claim the README never actually made: there
 * is currently NO environment separation at the Zoom-credential level.
 * Confirmed directly against Vercel: ZOOM_ACCOUNT_ID/ZOOM_CLIENT_ID/
 * ZOOM_CLIENT_SECRET are the exact same values on both the Preview and
 * Production environments, so a staging cohort's meeting is created on the
 * SAME real Zoom account production uses - not a separate app with
 * recording disabled at the account level, which is what X1's own prompt
 * actually required. See README.md's "Environments" section for the
 * current, honest state of this gap - it needs a second real Zoom app from
 * Ivan, not a code change. What DOES hold in every environment equally,
 * independent of which account is configured: the five enforced settings
 * (see meeting.ts) are applied at the application level on every meeting
 * this code creates, so recording stays blocked regardless of this gap.
 */

export interface ZoomCredentials {
  accountId: string;
  clientId: string;
  clientSecret: string;
}

export const ZOOM_API_BASE_URL = "https://api.zoom.us/v2";
const ZOOM_OAUTH_TOKEN_URL = "https://zoom.us/oauth/token";

// Zoom S2S OAuth tokens are valid for 1 hour; refresh a bit early so a
// long-running request never straddles expiry mid-call.
const TOKEN_EXPIRY_SAFETY_MARGIN_MS = 60_000;

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

const tokenCache = new Map<string, CachedToken>();

function cacheKeyFor(credentials: ZoomCredentials): string {
  return `${credentials.accountId}:${credentials.clientId}`;
}

/**
 * Reads the default (production or staging, whichever this deployment is
 * configured with) Zoom app credentials from the environment. Throws if
 * any are missing - there is no partial-credential state that makes sense
 * to proceed with.
 */
export function getDefaultZoomCredentials(): ZoomCredentials {
  const accountId = process.env.ZOOM_ACCOUNT_ID;
  const clientId = process.env.ZOOM_CLIENT_ID;
  const clientSecret = process.env.ZOOM_CLIENT_SECRET;

  if (!accountId || !clientId || !clientSecret) {
    throw new Error(
      "Missing Zoom Server-to-Server OAuth credentials: ZOOM_ACCOUNT_ID, " +
        "ZOOM_CLIENT_ID, and ZOOM_CLIENT_SECRET must all be set.",
    );
  }

  return { accountId, clientId, clientSecret };
}

/**
 * Exchanges (or reuses a cached) account-credentials grant for an access
 * token. Never logs the token or the client secret - only identifiers.
 *
 * fetchImpl defaults to the real global fetch; tests pass a mock directly
 * instead of stubbing globalThis.fetch, since test files in this project
 * run with a shared global scope - a stubbed global fetch in one file's
 * test can otherwise leak into a concurrently-running file's real network
 * calls (observed: it broke lib/health/check-health.test.ts's Supabase
 * calls when run alongside this file).
 */
export async function getZoomAccessToken(
  credentials: ZoomCredentials,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const key = cacheKeyFor(credentials);
  const cached = tokenCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.accessToken;
  }

  const basicAuth = Buffer.from(`${credentials.clientId}:${credentials.clientSecret}`).toString(
    "base64",
  );

  const response = await fetchImpl(
    `${ZOOM_OAUTH_TOKEN_URL}?grant_type=account_credentials&account_id=${encodeURIComponent(credentials.accountId)}`,
    {
      method: "POST",
      headers: { Authorization: `Basic ${basicAuth}` },
    },
  );

  if (!response.ok) {
    logError("zoom_oauth_token_failed", {
      accountId: credentials.accountId,
      status: response.status,
    });
    throw new Error(`Zoom OAuth token exchange failed with status ${response.status}`);
  }

  const body = (await response.json()) as { access_token: string; expires_in: number };
  tokenCache.set(key, {
    accessToken: body.access_token,
    expiresAt: Date.now() + body.expires_in * 1000 - TOKEN_EXPIRY_SAFETY_MARGIN_MS,
  });

  return body.access_token;
}

/**
 * Authenticated request against the Zoom API. Throws on any non-2xx
 * response rather than swallowing it - a facilitator discovering a silent
 * Zoom failure at session time is exactly the failure this integration
 * exists to prevent.
 */
export async function zoomApiRequest(
  path: string,
  init: RequestInit = {},
  credentials: ZoomCredentials = getDefaultZoomCredentials(),
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  const accessToken = await getZoomAccessToken(credentials, fetchImpl);

  const response = await fetchImpl(`${ZOOM_API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    logError("zoom_api_request_failed", {
      path,
      status: response.status,
      accountId: credentials.accountId,
    });
    throw new Error(`Zoom API request to ${path} failed with status ${response.status}: ${errorBody}`);
  }

  return response;
}
