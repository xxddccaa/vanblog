import {
  getThemeSnapshot,
  getThemePreferenceFromCookie,
  normalizeThemePreference,
  ThemePreference,
} from "./themeBoot";

export const initTheme = () => {
  if (typeof localStorage === "undefined") {
    return "dark";
  }

  const storedTheme = normalizeThemePreference(localStorage.getItem("theme"));
  if (storedTheme) {
    return storedTheme;
  }

  const cookieTheme = getThemePreferenceFromCookie(document.cookie);
  if (cookieTheme) {
    return cookieTheme;
  }

  return "dark";
};

export const getTheme = (theme: ThemePreference) => theme;

export const applyTheme = (
  theme: ThemePreference,
  source: string,
  disableLog = false
) => {
  const isLight = theme === "light";
  const documentTheme = isLight ? "light" : "dark";
  const { backgroundColor } = getThemeSnapshot({
    defaultTheme: theme,
  });

  if (isLight) {
    document.documentElement.classList.add("light");
    document.documentElement.classList.remove("dark");
    if (!disableLog) {
      // console.log(`[Apply Theme][${source}] ${theme}`);
    }
  } else {
    document.documentElement.classList.add("dark");
    document.documentElement.classList.remove("light");
    if (!disableLog) {
      // console.log(`[Apply Theme][${source}] ${theme}`);
    }
  }

  document.documentElement.dataset.theme = documentTheme;
  document.documentElement.style.backgroundColor = backgroundColor;
  document.documentElement.style.colorScheme = documentTheme;

  if (document.body) {
    document.body.dataset.theme = documentTheme;
    document.body.classList.toggle("light", isLight);
    document.body.classList.toggle("dark", !isLight);
    document.body.style.backgroundColor = "transparent";
  }
};
