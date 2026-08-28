import { describe, expect, it } from "vitest";
import { navItemsForRole } from "@/lib/admin/nav";

describe("navItemsForRole", () => {
  it("shows an internal admin everything, including partner organizations", () => {
    const hrefs = navItemsForRole("admin").map((item) => item.href);
    expect(hrefs).toEqual(["/admin/partners", "/admin/cohorts", "/admin/reports"]);
  });

  it("shows a facilitator only cohorts, labeled 'My cohorts'", () => {
    const items = navItemsForRole("facilitator");
    expect(items.map((item) => item.href)).toEqual(["/admin/cohorts"]);
    expect(items[0].label("facilitator")).toBe("My cohorts");
  });

  it("shows partner staff cohorts and reports, but not partner organizations", () => {
    const items = navItemsForRole("partner_staff");
    expect(items.map((item) => item.href)).toEqual(["/admin/cohorts", "/admin/reports"]);
    expect(items.find((item) => item.href === "/admin/cohorts")!.label("partner_staff")).toBe(
      "Cohorts",
    );
  });

  it("shows a member nothing - members have no admin surface at all", () => {
    expect(navItemsForRole("member")).toEqual([]);
  });
});
