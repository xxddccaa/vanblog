const resolveExpectedToken = () =>
  process.env.VANBLOG_ISR_TOKEN || process.env.WALINE_JWT_TOKEN || '';

export function isRevalidateRequestAuthorized(providedToken?: string | null) {
  const expectedToken = resolveExpectedToken();
  if (!expectedToken) {
    return process.env.NODE_ENV !== 'production';
  }
  return String(providedToken || '') === expectedToken;
}

export function isRevalidateTokenConfigured() {
  return Boolean(resolveExpectedToken());
}
