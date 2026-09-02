import { notFound } from "next/navigation";
import { AccountForm } from "@/components/account/account-form";
import { COPY } from "@/lib/copy";
import { getMyAccount } from "@/lib/account/data";

// L3 (remaining scope): the account screen the run doc's own acceptance
// line requires - name, email, phone, time zone, notification
// preferences, sign out, plus the two data-request actions, all on one
// screen ("small screen... do not hide these behind a settings
// submenu"). Lives inside (caregiver) - already gated behind a real
// signed-in session (L1).
export default async function AccountPage() {
  const account = await getMyAccount();
  if (!account) notFound();

  return (
    <div className="flex flex-col gap-section">
      <h1 className="text-h2">{COPY.account.title}</h1>
      <AccountForm account={account} />
    </div>
  );
}
