export const ADMIN_BASE_PATH = '/admin';
export const ADMIN_LOGIN_PATH = '/user/login';
export const ADMIN_INIT_PATH = '/init';
export const ADMIN_RESTORE_PATH = '/user/restore';

const AUTH_EXPIRED_REASON_KEY = 'vanblog.admin.auth-expired-reason';

let authExpiredRedirecting = false;

const isBrowser = () => typeof window !== 'undefined';

const getSessionStorage = () => {
  if (!isBrowser()) {
    return null;
  }

  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
};

const getLocalStorage = () => {
  if (!isBrowser()) {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

export const getStoredAdminToken = () => getLocalStorage()?.getItem('token') || '';

export const hasStoredAdminToken = () => Boolean(getStoredAdminToken());

// Mirrors the admin session into a cookie so a "private site" can let the owner
// read the public pages. The token is already readable by scripts through
// localStorage, so the cookie does not widen its exposure.
export const ADMIN_ACCESS_COOKIE = 'vanblog_token';
const ADMIN_ACCESS_COOKIE_MAX_AGE = 7 * 24 * 60 * 60;

const canWriteCookies = () => isBrowser() && typeof document !== 'undefined';

export const clearAdminAccessCookie = () => {
  if (!canWriteCookies()) {
    return;
  }
  document.cookie = `${ADMIN_ACCESS_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
};

export const syncAdminAccessCookie = (token = getStoredAdminToken()) => {
  if (!canWriteCookies()) {
    return;
  }
  if (!token) {
    clearAdminAccessCookie();
    return;
  }
  const secure = window.location?.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${ADMIN_ACCESS_COOKIE}=${encodeURIComponent(
    token,
  )}; Path=/; Max-Age=${ADMIN_ACCESS_COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
};

export const storeAdminToken = (token) => {
  getLocalStorage()?.setItem('token', token);
  syncAdminAccessCookie(token);
};

export const clearStoredAdminToken = () => {
  getLocalStorage()?.removeItem('token');
  clearAdminAccessCookie();
};

/** Site page to open after login; only same-site relative paths are accepted. */
export const getSafeSiteReturnPath = (value) => {
  const target = String(value || '');
  if (!target.startsWith('/') || target.startsWith('//') || target.includes('\\')) {
    return '';
  }
  return target;
};

export const isAuthExpiredResponse = (response) =>
  response?.statusCode === 401 && response?.message === 'Unauthorized';

export const buildAdminAbsolutePath = (path = '/') => {
  if (!path) {
    return `${ADMIN_BASE_PATH}/`;
  }

  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  if (path.startsWith(ADMIN_BASE_PATH)) {
    return path;
  }

  return `${ADMIN_BASE_PATH}${path.startsWith('/') ? path : `/${path}`}`;
};

export const buildAdminLoginUrl = (redirectPath = '/') => {
  const loginUrl = new URL(buildAdminAbsolutePath(ADMIN_LOGIN_PATH), 'http://vanblog.local');
  if (redirectPath) {
    loginUrl.searchParams.set('redirect', redirectPath);
  }
  return `${loginUrl.pathname}${loginUrl.search}`;
};

export const storeAdminAuthExpiredReason = (reason = '登录已过期，请重新登录') => {
  getSessionStorage()?.setItem(AUTH_EXPIRED_REASON_KEY, reason);
};

export const consumeAdminAuthExpiredReason = () => {
  const storage = getSessionStorage();
  const reason = storage?.getItem(AUTH_EXPIRED_REASON_KEY) || '';
  if (reason) {
    storage?.removeItem(AUTH_EXPIRED_REASON_KEY);
  }
  return reason;
};

const getCurrentLocationPath = () => {
  if (!isBrowser()) {
    return '/';
  }

  const { pathname = '', search = '', hash = '' } = window.location || {};
  return `${pathname}${search}${hash}` || '/';
};

const getSafeRedirectPath = (redirectPath) => {
  const nextPath = redirectPath || getCurrentLocationPath();
  const adminLoginPath = buildAdminAbsolutePath(ADMIN_LOGIN_PATH);
  const adminInitPath = buildAdminAbsolutePath(ADMIN_INIT_PATH);
  const adminRestorePath = buildAdminAbsolutePath(ADMIN_RESTORE_PATH);

  if (
    nextPath.startsWith(adminLoginPath) ||
    nextPath.startsWith(adminInitPath) ||
    nextPath.startsWith(adminRestorePath)
  ) {
    return buildAdminAbsolutePath('/');
  }

  return nextPath;
};

export const handleAdminAuthExpired = ({
  reason = '登录已过期，请重新登录',
  redirectPath,
} = {}) => {
  if (!isBrowser() || !hasStoredAdminToken() || authExpiredRedirecting) {
    return false;
  }

  authExpiredRedirecting = true;
  storeAdminAuthExpiredReason(reason);
  clearStoredAdminToken();

  const targetUrl = buildAdminLoginUrl(getSafeRedirectPath(redirectPath));
  window.location.assign(targetUrl);
  return true;
};

export const __resetAdminAuthExpiredRedirectStateForTest = () => {
  authExpiredRedirecting = false;
};
