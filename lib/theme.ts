export type Theme = "light" | "dark";

export const THEME_COOKIE = "kk_theme";
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export function isTheme(value: string | undefined | null): value is Theme {
  return value === "light" || value === "dark";
}

/**
 * Runs before hydration. If a theme cookie is already set, this just
 * confirms the class the server already rendered — no flash. If not (first
 * visit), it reads prefers-color-scheme, applies it, and persists it as a
 * cookie so the server renders correctly from then on.
 */
export const themeInitScript = `(function(){try{var m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=([^;]*)/);var t=m?decodeURIComponent(m[1]):null;if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.cookie="${THEME_COOKIE}="+t+"; path=/; max-age=${THEME_COOKIE_MAX_AGE}; SameSite=Lax";}document.documentElement.classList.toggle("dark",t==="dark");}catch(e){}})();`;
