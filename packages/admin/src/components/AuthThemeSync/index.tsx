import { useEffect, useState } from 'react';
import { useModel } from '@umijs/max';
import { getPublicSiteInfo } from '@/services/van-blog/api';
import { applyThemeToDocument, getInitTheme } from '@/services/van-blog/theme';
import { applyAdminFavicon } from '@/utils/adminBranding';
import { storeAdminThemeConfig } from '@/utils/adminTheme';

interface AuthThemeSyncProps {
  siteInfo?: Record<string, any> | null;
}

export default function AuthThemeSync({ siteInfo }: AuthThemeSyncProps) {
  const { initialState } = useModel('@@initialState');
  const [fallbackSiteInfo, setFallbackSiteInfo] = useState<Record<string, any> | null>(null);

  useEffect(() => {
    if (siteInfo) {
      return undefined;
    }

    let active = true;
    getPublicSiteInfo()
      .then(({ data }) => {
        if (!active) {
          return;
        }
        setFallbackSiteInfo(data || null);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [siteInfo]);

  useEffect(() => {
    const nextSiteInfo = siteInfo || fallbackSiteInfo;
    if (nextSiteInfo) {
      applyAdminFavicon(nextSiteInfo);
      storeAdminThemeConfig(nextSiteInfo.adminTheme);
    }

    applyThemeToDocument(initialState?.theme || getInitTheme(), nextSiteInfo?.adminTheme);
  }, [fallbackSiteInfo, initialState?.theme, siteInfo]);

  return null;
}
