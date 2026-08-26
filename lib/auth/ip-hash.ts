import "server-only";
import { createHmac } from "node:crypto";
import { headers } from "next/headers";

// We log identifier + method + outcome + IP hash for every sign-in
// attempt (P1 spec), never the raw IP - HMAC with a server-only secret so
// the hash isn't reversible or rainbow-table-able, but repeat attempts
// from the same address still hash identically for abuse review.
export async function hashRequestIp(): Promise<string | null> {
  const headerList = await headers();
  const forwardedFor = headerList.get("x-forwarded-for");
  const ip = forwardedFor?.split(",")[0]?.trim() ?? headerList.get("x-real-ip");

  if (!ip) return null;

  const secret = process.env.AUTH_IP_HASH_SECRET;
  if (!secret) {
    throw new Error("AUTH_IP_HASH_SECRET is not set");
  }

  return createHmac("sha256", secret).update(ip).digest("hex");
}
