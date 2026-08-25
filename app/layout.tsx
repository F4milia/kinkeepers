import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Atkinson_Hyperlegible_Next, Source_Serif_4 } from "next/font/google";
import { THEME_COOKIE, isTheme, themeInitScript, type Theme } from "@/lib/theme";
import "./globals.css";

const atkinsonHyperlegibleNext = Atkinson_Hyperlegible_Next({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-atkinson",
  display: "swap",
  preload: true,
});

const sourceSerif4 = Source_Serif_4({
  subsets: ["latin"],
  weight: ["600"],
  variable: "--font-source-serif",
  display: "swap",
  preload: true,
});

export const metadata: Metadata = {
  title: "KinKeepers",
  description: "A cohort program for family caregivers of someone with dementia.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const cookieTheme = cookieStore.get(THEME_COOKIE)?.value;
  const theme: Theme = isTheme(cookieTheme) ? cookieTheme : "light";

  return (
    <html
      lang="en"
      className={`${atkinsonHyperlegibleNext.variable} ${sourceSerif4.variable} ${theme === "dark" ? "dark" : ""}`}
      suppressHydrationWarning
    >
      <head>
        <meta name="color-scheme" content="light dark" />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
