import {
  handleAdminAuthExpired,
  hasStoredAdminToken,
  isAuthExpiredResponse,
} from '../utils/adminSession.js';

type RequestOptions = {
  method?: string;
  params?: Record<string, any>;
  data?: any;
  headers?: Record<string, string>;
  responseType?: 'blob';
  skipErrorHandler?: boolean;
  skipAuthExpiredHandler?: boolean;
};

function buildUrl(url: string, params?: Record<string, any>) {
  if (!params || Object.keys(params).length === 0) {
    return url;
  }

  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return;
    }
    search.append(key, String(value));
  });

  const query = search.toString();
  if (!query) {
    return url;
  }

  return url.includes('?') ? `${url}&${query}` : `${url}?${query}`;
}

export async function request(url: string, options: RequestOptions = {}) {
  const method = options.method || 'GET';
  const headers: Record<string, string> = {
    ...(options.headers || {}),
  };

  const token =
    typeof window !== 'undefined' ? window.localStorage.getItem('token') || 'null' : 'null';
  if (!headers.token) {
    headers.token = token;
  }

  const init: RequestInit = {
    method,
    headers,
  };

  if (options.data !== undefined) {
    if (options.data instanceof FormData) {
      init.body = options.data;
    } else {
      if (!headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
      }
      init.body = headers['Content-Type']?.includes('application/json')
        ? JSON.stringify(options.data)
        : options.data;
    }
  }

  const response = await fetch(buildUrl(url, options.params), init);

  const shouldHandleAuthExpired =
    !options.skipAuthExpiredHandler && hasStoredAdminToken() && responseTypeIsJsonLike(response);

  if (options.responseType === 'blob') {
    if (shouldHandleAuthExpired) {
      const parsed = await parseResponsePayload(response.clone());
      if (isAuthExpiredResponse(parsed)) {
        handleAdminAuthExpired();
      }
    }
    return response.blob();
  }

  const parsed = await parseResponsePayload(response);
  if (shouldHandleAuthExpired && isAuthExpiredResponse(parsed)) {
    handleAdminAuthExpired();
  }
  return parsed;
}

export default request;

function responseTypeIsJsonLike(response: Response) {
  const contentType = response.headers.get('content-type') || '';
  return (
    contentType.includes('application/json') ||
    contentType.includes('text/plain') ||
    contentType.includes('text/json')
  );
}

async function parseResponsePayload(response: Response) {
  const text = await response.text();
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
