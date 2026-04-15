import { getAdminAssetPath } from './getAssetPath';

export const DEFAULT_ADMIN_BRAND_ASSET = getAdminAssetPath('logo.svg');

const normalizeAssetUrl = (value?: string) => {
  const next = String(value || '').trim();
  return next || '';
};

export const resolveAdminBrandLogo = (siteInfo?: { adminLogo?: string }) =>
  normalizeAssetUrl(siteInfo?.adminLogo) || DEFAULT_ADMIN_BRAND_ASSET;

export const resolveAdminBrandFavicon = (siteInfo?: { adminFavicon?: string }) =>
  normalizeAssetUrl(siteInfo?.adminFavicon) || DEFAULT_ADMIN_BRAND_ASSET;

export const applyAdminFavicon = (siteInfo?: { adminFavicon?: string }) => {
  if (typeof document === 'undefined') {
    return;
  }

  const href = resolveAdminBrandFavicon(siteInfo);
  const selectors = [
    { rel: 'icon', id: 'vanblog-admin-favicon' },
    { rel: 'shortcut icon', id: 'vanblog-admin-favicon-shortcut' },
  ];

  selectors.forEach(({ rel, id }) => {
    let link = document.head.querySelector(`#${id}`) as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.id = id;
      link.rel = rel;
      document.head.appendChild(link);
    }
    if (link.href !== href) {
      link.href = href;
    }
  });
};
