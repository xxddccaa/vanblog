const crypto = require('crypto');

const CONTROL_TOKEN_HEADER = 'x-vanblog-control-token';

const getExpectedControlToken = (env = process.env) =>
  String(env.VANBLOG_WALINE_CONTROL_TOKEN || env.WALINE_JWT_TOKEN || '');

const normalizeHeaderValue = (value) => {
  if (Array.isArray(value)) {
    return String(value[0] || '');
  }
  return String(value || '');
};

const timingSafeStringEqual = (left, right) => {
  const leftBuffer = Buffer.from(String(left || ''));
  const rightBuffer = Buffer.from(String(right || ''));
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

const isAuthorizedControlRequest = (req, expectedToken = getExpectedControlToken()) => {
  if (!expectedToken) {
    return false;
  }
  const providedToken = normalizeHeaderValue(req?.headers?.[CONTROL_TOKEN_HEADER]);
  return timingSafeStringEqual(providedToken, expectedToken);
};

module.exports = {
  CONTROL_TOKEN_HEADER,
  getExpectedControlToken,
  isAuthorizedControlRequest,
};
