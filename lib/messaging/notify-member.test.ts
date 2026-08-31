import { describe, expect, it, vi, beforeEach } from "vitest";
import { notifyMember, type MemberContact } from "@/lib/messaging/notify-member";
import { sendEmail } from "@/lib/messaging/send-email";
import { sendSms } from "@/lib/messaging/send-sms";

vi.mock("@/lib/messaging/send-email", () => ({ sendEmail: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/messaging/send-sms", () => ({ sendSms: vi.fn().mockResolvedValue(undefined) }));

beforeEach(() => {
  vi.clearAllMocks();
});

const baseParams = {
  subject: "Subject",
  emailHtml: "<p>Body</p>",
  smsBody: "Body",
  logContext: {},
};

function contact(overrides: Partial<MemberContact> = {}): MemberContact {
  return { email: "member@example.com", phone: "+15551234567", preferredContactChannel: null, ...overrides };
}

describe("notifyMember", () => {
  it("defaults to email only when no preference was ever recorded", async () => {
    await notifyMember({ ...baseParams, contact: contact({ preferredContactChannel: null }) });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendSms).not.toHaveBeenCalled();
  });

  it("sends email only when the preference is 'email'", async () => {
    await notifyMember({ ...baseParams, contact: contact({ preferredContactChannel: "email" }) });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendSms).not.toHaveBeenCalled();
  });

  it("sends sms only when the preference is 'sms'", async () => {
    await notifyMember({ ...baseParams, contact: contact({ preferredContactChannel: "sms" }) });
    expect(sendSms).toHaveBeenCalledTimes(1);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("sends both when the preference is 'both'", async () => {
    await notifyMember({ ...baseParams, contact: contact({ preferredContactChannel: "both" }) });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendSms).toHaveBeenCalledTimes(1);
  });

  it("named edge case: preference is 'sms' but no phone is on file - degrades to nothing sent, not a crash", async () => {
    await notifyMember({
      ...baseParams,
      contact: contact({ preferredContactChannel: "sms", phone: null }),
    });
    expect(sendEmail).not.toHaveBeenCalled();
    expect(sendSms).not.toHaveBeenCalled();
  });

  it("named edge case: preference is 'both' but only email is on file - sends only what's reachable", async () => {
    await notifyMember({
      ...baseParams,
      contact: contact({ preferredContactChannel: "both", phone: null }),
    });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendSms).not.toHaveBeenCalled();
  });
});
