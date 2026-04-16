export type ThemePreference = "light" | "dark";
export type DocumentTheme = "light" | "dark";

const LIGHT_BACKGROUND = "#f4f8fb";
const DARK_BACKGROUND = "#0c1928";

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
  lightBackground = LIGHT_BACKGROUND,
  darkBackground = DARK_BACKGROUND,
}: {
  defaultTheme?: ThemePreference;
  preferredTheme?: string | null;
  lightBackground?: string;
  darkBackground?: string;
} = {}) => {
  const theme = resolveDocumentTheme({
    defaultTheme,
    preferredTheme,
  });

  return {
    theme,
    className: theme,
    dataTheme: theme,
    backgroundColor: theme === "dark" ? darkBackground : lightBackground,
    colorScheme: theme,
    bodyClassName: theme,
    bodyDataTheme: theme,
  };
};

export const getThemeBootstrapScript = (
  defaultTheme: ThemePreference = "dark",
  options?: {
    lightBackground?: string;
    darkBackground?: string;
  },
) => {
  const lightBackground = options?.lightBackground || LIGHT_BACKGROUND;
  const darkBackground = options?.darkBackground || DARK_BACKGROUND;

  return `(function(){try{var DEFAULT_THEME=${JSON.stringify(defaultTheme)};var LIGHT_BG="${lightBackground}";var DARK_BG="${darkBackground}";var normalizeTheme=function(theme){if(theme==="light"||theme==="dark"){return theme;}if(theme==="auto"){return "dark";}return null;};var readCookieTheme=function(){var match=document.cookie.match(/(?:^|; )theme=([^;]+)/);return match?normalizeTheme(match[1]):null;};var readStoredTheme=function(){try{return normalizeTheme(window.localStorage.getItem("theme"));}catch(error){return null;}};var writeTheme=function(theme){try{window.localStorage.setItem("theme",theme);}catch(error){}document.cookie="theme="+theme+"; path=/; max-age=31536000; samesite=lax";};var applyTheme=function(resolvedTheme){var root=document.documentElement;var isDark=resolvedTheme==="dark";var pageBg=isDark?DARK_BG:LIGHT_BG;var bgImageVar=isDark?"--bg-image-dark":"--bg-image";var bgImage=root.style.getPropertyValue(bgImageVar)||getComputedStyle(root).getPropertyValue(bgImageVar)||"none";var hasBgImage=bgImage&&bgImage!=="none"&&bgImage!=='url(\"\")';root.classList.remove("light","dark");root.classList.add(resolvedTheme);root.dataset.theme=resolvedTheme;root.style.backgroundColor=pageBg;root.style.colorScheme=resolvedTheme;var body=document.body;if(body){body.dataset.theme=resolvedTheme;body.classList.remove("light","dark");body.classList.add(resolvedTheme);body.style.backgroundColor=hasBgImage?"transparent":pageBg;}};var resolvedTheme=readStoredTheme()||readCookieTheme()||normalizeTheme(DEFAULT_THEME)||"dark";applyTheme(resolvedTheme);writeTheme(resolvedTheme);if(!document.body){document.addEventListener("DOMContentLoaded",function(){applyTheme(resolvedTheme);},{once:true});}}catch(error){}})();`;
};
