import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { ComponentGallery } from "./gallery";
import { isTheme, THEME_COOKIE, type Theme } from "@/lib/theme";

export const metadata = {
  title: "Components — KinKeepers",
};

// Dev-only review route — not part of the product surface.
export default async function ComponentsPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const cookieStore = await cookies();
  const cookieTheme = cookieStore.get(THEME_COOKIE)?.value;
  const initialTheme: Theme = isTheme(cookieTheme) ? cookieTheme : "light";

  return <ComponentGallery initialTheme={initialTheme} />;
}
