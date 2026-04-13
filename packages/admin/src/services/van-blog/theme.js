export const getInitTheme = () => {
  let theme = 'auto';
  if (!('theme' in localStorage) || localStorage.theme == 'auto') {
    return 'auto';
  } else {
    if (localStorage.theme === 'dark') {
      theme = 'dark';
    } else {
      theme = 'light';
    }
  }
  return theme;
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
  if (theme == 'auto') {
    return decodeAutoTheme();
  } else {
    if (theme == 'light') {
      return 'light';
    } else {
      return 'realDark';
    }
  }
};

export const applyThemeToDocument = (theme) => {
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

  return resolvedTheme;
};

export const beforeSwitchTheme = (to) => {
  if (to == 'light') {
    localStorage.theme = 'light';
  } else if (to == 'auto') {
    localStorage.theme = 'auto';
  } else {
    localStorage.theme = 'dark';
  }
  return applyThemeToDocument(to);
};
