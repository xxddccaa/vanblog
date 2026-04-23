import test from 'node:test';
import assert from 'node:assert/strict';

import { request } from '../packages/admin/src/services/request.ts';
import {
  __resetAdminAuthExpiredRedirectStateForTest,
  buildAdminAbsolutePath,
  buildAdminLoginUrl,
  consumeAdminAuthExpiredReason,
  isAuthExpiredResponse,
  storeAdminAuthExpiredReason,
} from '../packages/admin/src/utils/adminSession.js';

const createStorage = () => {
  const state = new Map();

  return {
    clear() {
      state.clear();
    },
    getItem(key) {
      return state.has(key) ? state.get(key) : null;
    },
    removeItem(key) {
      state.delete(key);
    },
    setItem(key, value) {
      state.set(key, String(value));
    },
  };
};

const createWindow = (locationOverrides = {}) => {
  const localStorage = createStorage();
  const sessionStorage = createStorage();
  const location = {
    pathname: '/admin/article',
    search: '?page=2',
    hash: '#filters',
    assigned: '',
    assign(url) {
      this.assigned = url;
    },
    ...locationOverrides,
  };

  return {
    localStorage,
    sessionStorage,
    location,
  };
};

test.beforeEach(() => {
  globalThis.window = createWindow();
  __resetAdminAuthExpiredRedirectStateForTest();
});

test.afterEach(() => {
  delete globalThis.fetch;
  delete globalThis.window;
});

test('recognizes only guard-style Unauthorized responses as session expiry', () => {
  assert.equal(isAuthExpiredResponse({ statusCode: 401, message: 'Unauthorized' }), true);
  assert.equal(isAuthExpiredResponse({ statusCode: 401, message: '用户名或密码错误！' }), false);
  assert.equal(isAuthExpiredResponse({ statusCode: 403, message: 'Forbidden resource' }), false);
});

test('stores and consumes the auth-expired prompt once', () => {
  storeAdminAuthExpiredReason('登录已过期，请重新登录');

  assert.equal(consumeAdminAuthExpiredReason(), '登录已过期，请重新登录');
  assert.equal(consumeAdminAuthExpiredReason(), '');
});

test('builds login redirects under the admin prefix', () => {
  assert.equal(buildAdminAbsolutePath('/article'), '/admin/article');
  assert.equal(
    buildAdminLoginUrl('/admin/article?page=2'),
    '/admin/user/login?redirect=%2Fadmin%2Farticle%3Fpage%3D2',
  );
});

test('request clears stale token and redirects to login when admin session expires', async () => {
  window.localStorage.setItem('token', 'expired-token');
  globalThis.fetch = async () => ({
    headers: {
      get: () => 'application/json',
    },
    text: async () => JSON.stringify({ statusCode: 401, message: 'Unauthorized' }),
  });

  const response = await request('/api/admin/article');

  assert.deepEqual(response, { statusCode: 401, message: 'Unauthorized' });
  assert.equal(window.localStorage.getItem('token'), null);
  assert.equal(
    window.location.assigned,
    '/admin/user/login?redirect=%2Fadmin%2Farticle%3Fpage%3D2%23filters',
  );
  assert.equal(consumeAdminAuthExpiredReason(), '登录已过期，请重新登录');
});

test('request can skip auth-expiry redirect for login/bootstrap flows', async () => {
  window.localStorage.setItem('token', 'stale-token');
  globalThis.fetch = async () => ({
    headers: {
      get: () => 'application/json',
    },
    text: async () => JSON.stringify({ statusCode: 401, message: 'Unauthorized' }),
  });

  const response = await request('/api/admin/meta', {
    skipAuthExpiredHandler: true,
  });

  assert.deepEqual(response, { statusCode: 401, message: 'Unauthorized' });
  assert.equal(window.localStorage.getItem('token'), 'stale-token');
  assert.equal(window.location.assigned, '');
  assert.equal(consumeAdminAuthExpiredReason(), '');
});
