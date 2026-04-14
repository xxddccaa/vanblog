const test = require('node:test');
const assert = require('node:assert/strict');

const {
  CONTROL_TOKEN_HEADER,
  getExpectedControlToken,
  isAuthorizedControlRequest,
} = require('./control-auth.cjs');

test('getExpectedControlToken prefers dedicated website token, then ISR token, then waline token', () => {
  assert.equal(
    getExpectedControlToken({
      VANBLOG_WEBSITE_CONTROL_TOKEN: 'website-secret',
      VANBLOG_ISR_TOKEN: 'isr-secret',
      WALINE_JWT_TOKEN: 'waline-secret',
    }),
    'website-secret',
  );
  assert.equal(
    getExpectedControlToken({
      VANBLOG_ISR_TOKEN: 'isr-secret',
      WALINE_JWT_TOKEN: 'waline-secret',
    }),
    'isr-secret',
  );
  assert.equal(getExpectedControlToken({ WALINE_JWT_TOKEN: 'waline-secret' }), 'waline-secret');
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
