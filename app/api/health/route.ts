import { NextResponse } from "next/server";
import { checkHealth } from "@/lib/health/check-health";

// P7b (Wave 9) wires uptime monitoring to hit this endpoint. No auth
// required - it reports dependency status only, never data.
export async function GET() {
  const result = await checkHealth();
  return NextResponse.json(result, { status: result.status === "healthy" ? 200 : 503 });
}
