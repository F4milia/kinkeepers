import { NextResponse } from "next/server";
import { getPartnerAttendanceExportRows } from "@/lib/admin/reports";
import { UnauthenticatedError, ForbiddenError } from "@/lib/auth/roles";
import { toCsv } from "@/lib/csv";

// A5's "Export attendance and delivery (CSV)" - partner_staff only.
// requireRole (inside getPartnerAttendanceExportRows) is the real gate;
// the try/catch here only turns its thrown errors into a proper HTTP
// status instead of a raw 500, since a Route Handler has no error.tsx to
// catch them the way a page does.
export async function GET() {
  try {
    const rows = await getPartnerAttendanceExportRows();
    const csv = toCsv(
      ["Applicant", "Partner Reference ID", "Cohort", "Status", "Session Number", "Attendance"],
      rows.map((row) => [
        [row.firstName, row.lastName].filter(Boolean).join(" ") || "Unnamed applicant",
        row.partnerReferenceId,
        row.cohortName,
        row.status,
        row.sessionNumber,
        row.attendanceStatus,
      ]),
    );

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="attendance-and-delivery.csv"',
      },
    });
  } catch (err) {
    if (err instanceof UnauthenticatedError) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    throw err;
  }
}
