import Link from "next/link";
import { requireRole } from "@/lib/auth/roles";
import { navItemsForRole } from "@/lib/admin/nav";

// Minimal landing: the nav (rendered by the layout) is the real
// navigation surface. This just orients whoever lands on the bare
// /admin URL toward wherever their role actually has something to do.
export default async function AdminHomePage() {
  const { role } = await requireRole(["admin", "facilitator", "partner_staff"]);
  const items = navItemsForRole(role);

  return (
    <div className="max-w-2xl">
      <h1 className="text-h1 font-heading text-ink">Admin</h1>
      <ul className="mt-4 flex flex-col gap-2">
        {items.map((item) => (
          <li key={item.href}>
            <Link href={item.href} className="text-body font-ui text-action underline">
              {item.label(role)}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
