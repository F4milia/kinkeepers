import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getDefaultZoomCredentials,
  getZoomAccessToken,
  zoomApiRequest,
  ZOOM_API_BASE_URL,
} from "@/lib/zoom/client";

// No real Zoom Server-to-Server OAuth credentials exist anywhere in this
// project yet (confirmed: not in .env.local.example, not in any GitHub
// secret, not anywhere). These tests verify the client's logic - request
// shapes, caching, error handling - against an injected mock fetch. They
// do not and cannot verify against the real Zoom API; that needs real
// credentials, which is Ivan's setup per the session prompt.
//
// fetch is injected as a parameter rather than stubbed on globalThis:
// test files in this project run with a shared global scope, so a
// globally-stubbed fetch in this file can otherwise leak into a
// concurrently-running file's real network calls.

// The token cache is keyed by accountId:clientId and lives for the life of
// the module, so every test needs its own unique credentials - reusing one
// across tests would let an earlier test's cached token silently satisfy a
// later test without ever calling the mock fetch.
let credentialCounter = 0;
function freshCredentials() {
  credentialCounter += 1;
  return {
    accountId: `acct-${credentialCounter}`,
    clientId: `client-${credentialCounter}`,
    clientSecret: `secret-${credentialCounter}`,
  };
}

beforeEach(() => {
  vi.unstubAllEnvs();
});

describe("getDefaultZoomCredentials", () => {
  it("throws when any credential env var is missing", () => {
    expect(() => getDefaultZoomCredentials()).toThrow(/Missing Zoom Server-to-Server/);
  });

  it("returns all three values when set", () => {
    vi.stubEnv("ZOOM_ACCOUNT_ID", "acct-1");
    vi.stubEnv("ZOOM_CLIENT_ID", "client-1");
    vi.stubEnv("ZOOM_CLIENT_SECRET", "secret-1");
    expect(getDefaultZoomCredentials()).toEqual({
      accountId: "acct-1",
      clientId: "client-1",
      clientSecret: "secret-1",
    });
  });
});

describe("getZoomAccessToken", () => {
  it("exchanges credentials for a token via Basic auth on the account-credentials grant", async () => {
    const credentials = freshCredentials();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ access_token: "tok-abc", expires_in: 3600 }),
    });

    const token = await getZoomAccessToken(credentials, fetchMock as unknown as typeof fetch);

    expect(token).toBe("tok-abc");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("grant_type=account_credentials");
    expect(url).toContain(`account_id=${credentials.accountId}`);
    const expectedAuth = `Basic ${Buffer.from(`${credentials.clientId}:${credentials.clientSecret}`).toString("base64")}`;
    expect(init.headers.Authorization).toBe(expectedAuth);
  });

  it("caches the token and does not re-fetch within its validity window", async () => {
    const credentials = freshCredentials();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ access_token: "tok-cached", expires_in: 3600 }),
    });

    await getZoomAccessToken(credentials, fetchMock as unknown as typeof fetch);
    await getZoomAccessToken(credentials, fetchMock as unknown as typeof fetch);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("re-fetches once the cached token has expired", async () => {
    const credentials = freshCredentials();
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ access_token: "tok-1", expires_in: 3600 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ access_token: "tok-2", expires_in: 3600 }),
      });

    await getZoomAccessToken(credentials, fetchMock as unknown as typeof fetch);
    vi.advanceTimersByTime(3600 * 1000 + 1);
    const second = await getZoomAccessToken(credentials, fetchMock as unknown as typeof fetch);

    expect(second).toBe("tok-2");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("throws rather than swallowing a failed token exchange", async () => {
    const credentials = freshCredentials();
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 401, text: async () => "unauthorized" });
    await expect(
      getZoomAccessToken(credentials, fetchMock as unknown as typeof fetch),
    ).rejects.toThrow(/status 401/);
  });
});

describe("zoomApiRequest", () => {
  it("attaches a Bearer token and calls the Zoom API base URL", async () => {
    const credentials = freshCredentials();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ access_token: "tok-x", expires_in: 3600 }),
      })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ id: "meeting-1" }) });

    await zoomApiRequest(
      "/users/me/meetings",
      { method: "POST" },
      credentials,
      fetchMock as unknown as typeof fetch,
    );

    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe(`${ZOOM_API_BASE_URL}/users/me/meetings`);
    expect(init.headers.Authorization).toBe("Bearer tok-x");
  });

  it("throws rather than swallowing a failed API call", async () => {
    const credentials = freshCredentials();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ access_token: "tok-x", expires_in: 3600 }),
      })
      .mockResolvedValueOnce({ ok: false, status: 400, text: async () => "bad request" });

    await expect(
      zoomApiRequest("/users/me/meetings", {}, credentials, fetchMock as unknown as typeof fetch),
    ).rejects.toThrow(/status 400/);
  });
});
