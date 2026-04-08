export const getAdminAssetPath = (assetPath: string) => {
  const normalized = assetPath.startsWith('/') ? assetPath : `/${assetPath}`;
  return process.env.NODE_ENV === 'production' ? `/admin${normalized}` : normalized;
};
