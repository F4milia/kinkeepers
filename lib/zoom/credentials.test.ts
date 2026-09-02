import { describe, expect, it, vi, beforeEach } from "vitest";
import { resolveZoomCredentialsForPartner } from "@/lib/zoom/credentials";

const maybeSingle = vi.fn();
const eq = vi.fn(() => ({ maybeSingle }));
const select = vi.fn(() => ({ eq }));
const from = vi.fn(() => ({ select }));
const admin = { from } as unknown as Parameters<typeof resolveZoomCredentialsForPartner>[0];

describe("resolveZoomCredentialsForPartner", () => {
  beforeEach(() => {
    from.mockClear();
    maybeSingle.mockReset();
    vi.stubEnv("ZOOM_ACCOUNT_ID", "default-acct");
    vi.stubEnv("ZOOM_CLIENT_ID", "default-client");
    vi.stubEnv("ZOOM_CLIENT_SECRET", "default-secret");
  });

  it("falls back to the default account when no partnerOrganizationId is given", async () => {
    const result = await resolveZoomCredentialsForPartner(admin, undefined);

    expect(from).not.toHaveBeenCalled();
    expect(result).toEqual({
      credentials: { accountId: "default-acct", clientId: "default-client", clientSecret: "default-secret" },
      provider: "kinkeepers",
    });
  });

  it("falls back to the default account when the partner has never had credentials provisioned", async () => {
    maybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const result = await resolveZoomCredentialsForPartner(admin, "partner-1");

    expect(from).toHaveBeenCalledWith("partner_zoom_credentials");
    expect(eq).toHaveBeenCalledWith("partner_organization_id", "partner-1");
    expect(result.provider).toBe("kinkeepers");
  });

  it("uses the partner's own credentials when a row exists", async () => {
    maybeSingle.mockResolvedValueOnce({
      data: { account_id: "partner-acct", client_id: "partner-client", client_secret: "partner-secret" },
      error: null,
    });

    const result = await resolveZoomCredentialsForPartner(admin, "partner-1");

    expect(result).toEqual({
      credentials: { accountId: "partner-acct", clientId: "partner-client", clientSecret: "partner-secret" },
      provider: "partner",
    });
  });

  it("throws the real error rather than swallowing it when the lookup fails", async () => {
    maybeSingle.mockResolvedValueOnce({ data: null, error: new Error("permission denied") });

    await expect(resolveZoomCredentialsForPartner(admin, "partner-1")).rejects.toThrow("permission denied");
  });
});
