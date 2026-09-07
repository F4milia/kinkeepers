import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import { clientForUser } from "@/test/helpers/local-auth";
import { getConsentStatus, type ConsentDocumentType } from "@/lib/consent/data";

const admin = createAdminClient();
const DOCUMENT_TYPES: ConsentDocumentType[] = [
  "terms_of_service",
  "privacy_policy",
  "participant_agreement",
  "group_confidentiality",
];

describe("getConsentStatus", () => {
  let memberUserId: string;
  // consent_documents is real, shared, and never rolled back between test
  // runs (this admin client writes real committed rows, same shape as the
  // audit_log/analytics_events tables CLAUDE.md's Learned Constraints
  // already warns about) - a hardcoded version number here collided with
  // itself on a second run. A version far outside any real migration's
  // range, cleaned up explicitly in afterAll, avoids that permanently.
  const TEST_ONLY_VERSION = 900000 + Math.floor(Math.random() * 100000);

  beforeAll(async () => {
    const { data, error } = await admin.auth.admin.createUser({
      email: `consent-data-test-${Date.now()}@example.com`,
      email_confirm: true,
    });
    if (error || !data.user) throw error ?? new Error("createUser failed");
    memberUserId = data.user.id;
  });

  afterAll(async () => {
    await admin.from("member_consents").delete().eq("member_id", memberUserId);
    await admin.auth.admin.deleteUser(memberUserId);
    await admin
      .from("consent_documents")
      .delete()
      .eq("document_type", "terms_of_service")
      .eq("version", TEST_ONLY_VERSION);
  });

  it("returns an empty array for a signed-out caller", async () => {
    const anonClient = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    expect(await getConsentStatus(anonClient)).toEqual([]);
  });

  it("returns all 4 documents as 'pending' for a member who has never consented, in the fixed order ending with group_confidentiality", async () => {
    const client = await clientForUser(memberUserId);
    const status = await getConsentStatus(client);

    expect(status.map((s) => s.documentType)).toEqual(DOCUMENT_TYPES);
    for (const doc of status) {
      expect(doc.status).toBe("pending");
      expect(doc.agreedAt).toBeNull();
    }
  });

  it("shows 'consented' with the real agreedAt once a member has a real consent row for the current version", async () => {
    const { data: currentDoc, error: docError } = await admin
      .from("consent_documents")
      .select("version")
      .eq("document_type", "terms_of_service")
      .order("version", { ascending: false })
      .limit(1)
      .single();
    if (docError || !currentDoc) throw docError ?? new Error("no terms_of_service document seeded");

    const { error: consentError } = await admin.from("member_consents").insert({
      member_id: memberUserId,
      document_type: "terms_of_service",
      document_version: currentDoc.version,
    });
    if (consentError) throw consentError;

    const client = await clientForUser(memberUserId);
    const status = await getConsentStatus(client);
    const terms = status.find((s) => s.documentType === "terms_of_service");

    expect(terms?.status).toBe("consented");
    expect(terms?.version).toBe(currentDoc.version);
    expect(terms?.agreedAt).not.toBeNull();

    // Every other document is untouched by this one consent.
    const others = status.filter((s) => s.documentType !== "terms_of_service");
    for (const doc of others) {
      expect(doc.status).toBe("pending");
    }
  });

  it("shows changeSummary only on a re-consent - never on a first-time consent to a newer document", async () => {
    // Builds on the previous test's state: memberUserId already consented
    // to terms_of_service's version-1 (the only version that existed at
    // the time). Bumping the version now makes that consent "older."
    const { data: bumped, error: bumpError } = await admin
      .from("consent_documents")
      .insert({
        document_type: "terms_of_service",
        version: TEST_ONLY_VERSION,
        body: "Updated terms of service body.",
        is_placeholder: true,
        change_summary: "We clarified how long we retain session recordings metadata.",
      })
      .select("version")
      .single();
    if (bumpError || !bumped) throw bumpError ?? new Error("failed to insert the test-only version");

    const client = await clientForUser(memberUserId);
    const status = await getConsentStatus(client);
    const terms = status.find((s) => s.documentType === "terms_of_service");

    expect(terms?.status).toBe("pending");
    expect(terms?.version).toBe(TEST_ONLY_VERSION);
    expect(terms?.changeSummary).toBe("We clarified how long we retain session recordings metadata.");

    // group_confidentiality etc. were never consented at all (first-time,
    // not a re-consent) - changeSummary must stay null even though its
    // own document row happens to have no change_summary set either way.
    const neverConsented = status.find((s) => s.documentType === "group_confidentiality");
    expect(neverConsented?.status).toBe("pending");
    expect(neverConsented?.changeSummary).toBeNull();
  });
});
