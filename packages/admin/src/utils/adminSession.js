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

export const clearStoredAdminToken = () => {
  getLocalStorage()?.removeItem('token');
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
