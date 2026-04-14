const test = require('node:test');
const assert = require('node:assert/strict');

const {
  CONTROL_TOKEN_HEADER,
  getExpectedControlToken,
  isAuthorizedControlRequest,
} = require('./control-auth.cjs');

test('getExpectedControlToken prefers explicit control token over waline jwt token', () => {
  assert.equal(
    getExpectedControlToken({
      VANBLOG_WALINE_CONTROL_TOKEN: 'control-secret',
      WALINE_JWT_TOKEN: 'waline-secret',
    }),
    'control-secret',
  );
  assert.equal(getExpectedControlToken({ WALINE_JWT_TOKEN: 'waline-secret' }), 'waline-secret');
});

test('isAuthorizedControlRequest validates the control token header', () => {
  assert.equal(
    isAuthorizedControlRequest(
      {
        headers: {
          [CONTROL_TOKEN_HEADER]: 'control-secret',
        },
      },
      'control-secret',
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
      'control-secret',
    ),
    false,
  );
  assert.equal(isAuthorizedControlRequest({ headers: {} }, ''), false);
});
