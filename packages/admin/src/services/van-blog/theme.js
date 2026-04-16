import { applyAdminTheme } from '@/utils/adminTheme';

export const getInitTheme = () => {
  if (!('theme' in localStorage)) {
    return 'light';
  }

  if (localStorage.theme === 'dark') {
    return 'dark';
  }

  if (localStorage.theme === 'auto') {
    const migratedTheme = decodeAutoTheme() === 'realDark' ? 'dark' : 'light';
    localStorage.theme = migratedTheme;
    return migratedTheme;
  }

  return 'light';
};
export const decodeAutoTheme = () => {
  const d = new Date().getHours();
  const night = d > 18 || d < 8;
  if (night || window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'realDark';
  } else {
    return 'light';
  }
};
export const mapTheme = (theme) => {
  // 把自己定义的主题变成系统的
  if (theme == 'light') {
    return 'light';
  }

  return 'realDark';
};

export const applyThemeToDocument = (theme, adminThemeConfig) => {
  if (typeof document === 'undefined') {
    return mapTheme(theme);
  }

  const resolvedTheme = mapTheme(theme);
  const isDark = resolvedTheme === 'realDark';
  const documentTheme = isDark ? 'dark' : 'light';
  const body = document.body;

  document.documentElement.dataset.theme = documentTheme;
  document.documentElement.style.colorScheme = documentTheme;
  document.documentElement.classList.toggle('dark', isDark);

  if (body) {
    body.dataset.theme = documentTheme;
    body.style.colorScheme = documentTheme;
    body.classList.toggle('dark', isDark);
  }

  applyAdminTheme(documentTheme, adminThemeConfig, {
    persist: adminThemeConfig !== undefined,
  });

  return resolvedTheme;
};

export const beforeSwitchTheme = (to) => {
  if (to == 'light') {
    localStorage.theme = 'light';
  } else {
    localStorage.theme = 'dark';
  }
  return applyThemeToDocument(to);
};
