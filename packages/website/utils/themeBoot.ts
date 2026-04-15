export type ThemePreference = "light" | "dark";
export type DocumentTheme = "light" | "dark";

const LIGHT_BACKGROUND = "#f1f5f9";
const DARK_BACKGROUND = "#1d2025";

export const normalizeThemePreference = (
  theme?: string | null,
): ThemePreference | null => {
  if (theme === "light" || theme === "dark") {
    return theme;
  }

  if (theme === "auto") {
    return "dark";
  }

  return null;
};

export const getThemePreferenceFromCookie = (cookieHeader?: string | null) => {
  if (!cookieHeader) {
    return null;
  }

  for (const rawPart of cookieHeader.split(";")) {
    const part = rawPart.trim();
    if (!part) {
      continue;
    }

    const [name, ...valueParts] = part.split("=");
    if ((name || "").trim() !== "theme") {
      continue;
    }

    return normalizeThemePreference(valueParts.join("="));
  }

  return null;
};

export const resolveDocumentTheme = ({
  defaultTheme = "dark",
  preferredTheme,
}: {
  defaultTheme?: ThemePreference;
  preferredTheme?: string | null;
} = {}): DocumentTheme => {
  const selectedTheme =
    normalizeThemePreference(preferredTheme) ||
    normalizeThemePreference(defaultTheme) ||
    "dark";

  return selectedTheme;
};

export const getThemeSnapshot = ({
  defaultTheme = "dark",
  preferredTheme,
}: {
  defaultTheme?: ThemePreference;
  preferredTheme?: string | null;
} = {}) => {
  const theme = resolveDocumentTheme({
    defaultTheme,
    preferredTheme,
  });

  return {
    theme,
    className: theme,
    dataTheme: theme,
    backgroundColor: theme === "dark" ? DARK_BACKGROUND : LIGHT_BACKGROUND,
    colorScheme: theme,
  };
};

export const getThemeBootstrapScript = (defaultTheme: ThemePreference = "dark") =>
  `(function(){try{var DEFAULT_THEME=${JSON.stringify(defaultTheme)};var LIGHT_BG="${LIGHT_BACKGROUND}";var DARK_BG="${DARK_BACKGROUND}";var normalizeTheme=function(theme){if(theme==="light"||theme==="dark"){return theme;}if(theme==="auto"){return "dark";}return null;};var readCookieTheme=function(){var match=document.cookie.match(/(?:^|; )theme=([^;]+)/);return match?normalizeTheme(match[1]):null;};var readStoredTheme=function(){try{return normalizeTheme(window.localStorage.getItem("theme"));}catch(error){return null;}};var writeTheme=function(theme){try{window.localStorage.setItem("theme",theme);}catch(error){}document.cookie="theme="+theme+"; path=/; max-age=31536000; samesite=lax";};var applyTheme=function(resolvedTheme){var root=document.documentElement;root.classList.remove("light","dark");root.classList.add(resolvedTheme);root.dataset.theme=resolvedTheme;root.style.backgroundColor=resolvedTheme==="dark"?DARK_BG:LIGHT_BG;root.style.colorScheme=resolvedTheme;var body=document.body;if(body){body.dataset.theme=resolvedTheme;body.classList.remove("light","dark");body.classList.add(resolvedTheme);body.style.backgroundColor="transparent";}};var resolvedTheme=readStoredTheme()||readCookieTheme()||normalizeTheme(DEFAULT_THEME)||"dark";applyTheme(resolvedTheme);writeTheme(resolvedTheme);if(!document.body){document.addEventListener("DOMContentLoaded",function(){applyTheme(resolvedTheme);},{once:true});}}catch(error){}})();`;
