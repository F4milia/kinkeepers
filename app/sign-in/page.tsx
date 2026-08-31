import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignInForm } from "@/components/auth/sign-in-form";
import { SupportAffordance } from "@/components/support-affordance";
import { ThemeToggle } from "@/components/theme-toggle";
import { getCurrentRole } from "@/lib/auth/roles";
import { THEME_COOKIE, isTheme, type Theme } from "@/lib/theme";

// L1 | the first screen an unauthenticated visitor sees — no TabBar, no
// nav, nothing signed-in state depends on. Already-signed-in visitors are
// bounced to Home rather than shown this screen again.
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const role = await getCurrentRole();
  if (role) redirect("/");

  const { error } = await searchParams;
  const cookieStore = await cookies();
  const cookieTheme = cookieStore.get(THEME_COOKIE)?.value;
  const theme: Theme = isTheme(cookieTheme) ? cookieTheme : "light";

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="flex items-center justify-end gap-2 px-4 py-2">
        <ThemeToggle initialTheme={theme} />
        <SupportAffordance />
      </header>
      <main className="mx-auto flex w-full max-w-content flex-1 flex-col justify-center px-4 pb-16">
        <SignInForm linkInvalid={error === "link_invalid"} />
      </main>
    </div>
  );
}
