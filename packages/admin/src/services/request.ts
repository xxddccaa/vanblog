type RequestOptions = {
  method?: string;
  params?: Record<string, any>;
  data?: any;
  headers?: Record<string, string>;
  responseType?: 'blob';
  skipErrorHandler?: boolean;
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

  if (options.responseType === 'blob') {
    return response.blob();
  }

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

export default request;
