export const configuredRevalidate =
  process.env.VAN_BLOG_REVALIDATE === 'true'
    ? Number.parseInt(process.env.VAN_BLOG_REVALIDATE_TIME || '10', 10) || 10
    : false;

export const toStaticParams = <T extends Record<string, string>>(
  paths: Array<{ params: T }>
): T[] => paths.map(({ params }) => params);
