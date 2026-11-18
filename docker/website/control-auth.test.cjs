const test = require('node:test');
const assert = require('node:assert/strict');

const {
  CONTROL_TOKEN_HEADER,
  getExpectedControlToken,
  isAuthorizedControlRequest,
} = require('./control-auth.cjs');

test('getExpectedControlToken prefers website token, then ISR token, then shared secret, then legacy name', () => {
  assert.equal(
    getExpectedControlToken({
      VANBLOG_WEBSITE_CONTROL_TOKEN: 'website-secret',
      VANBLOG_ISR_TOKEN: 'isr-secret',
      VANBLOG_SHARED_SECRET: 'shared-secret',
      WALINE_JWT_TOKEN: 'legacy-secret',
    }),
    'website-secret',
  );
  assert.equal(
    getExpectedControlToken({
      VANBLOG_ISR_TOKEN: 'isr-secret',
      VANBLOG_SHARED_SECRET: 'shared-secret',
      WALINE_JWT_TOKEN: 'legacy-secret',
    }),
    'isr-secret',
  );
  assert.equal(
    getExpectedControlToken({
      VANBLOG_SHARED_SECRET: 'shared-secret',
      WALINE_JWT_TOKEN: 'legacy-secret',
    }),
    'shared-secret',
  );
  assert.equal(getExpectedControlToken({ WALINE_JWT_TOKEN: 'legacy-secret' }), 'legacy-secret');
  assert.equal(getExpectedControlToken({}), '');
});

test('isAuthorizedControlRequest validates the website control token header', () => {
  assert.equal(
    isAuthorizedControlRequest(
      {
        headers: {
          [CONTROL_TOKEN_HEADER]: 'website-secret',
        },
      },
      'website-secret',
    ),
    true,
  );
  assert.equal(
    isAuthorizedControlRequest(
      {
        headers: {
          [CONTROL_TOKEN_HEADER]: 'wrong-secret',
        },
      },
      'website-secret',
    ),
    false,
  );
  assert.equal(isAuthorizedControlRequest({ headers: {} }, ''), false);
});
