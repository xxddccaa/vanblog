/**
 * Secret shared with the API server: authorizes ISR revalidation calls and
 * marks the website's own server-side requests. `VANBLOG_SHARED_SECRET` is the
 * deployment-wide name; `WALINE_JWT_TOKEN` is its legacy name and stays the
 * last fallback so upgraded deployments keep using the same value.
 */
export const resolveSharedSecret = () =>
  process.env.VANBLOG_ISR_TOKEN ||
  process.env.VANBLOG_SHARED_SECRET ||
  process.env.WALINE_JWT_TOKEN ||
  '';
