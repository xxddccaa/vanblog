import { Grid } from 'antd';
import { useMemo } from 'react';

const getFallbackWidth = () => {
  if (typeof window === 'undefined') {
    return 1280;
  }

  return window.innerWidth;
};

export default function useAdminResponsive() {
  const screens = Grid.useBreakpoint();
  const fallbackWidth = getFallbackWidth();

  return useMemo(() => {
    const mobile = typeof screens.md === 'boolean' ? !screens.md : fallbackWidth < 768;
    const tablet =
      typeof screens.md === 'boolean' && typeof screens.lg === 'boolean'
        ? screens.md && !screens.lg
        : fallbackWidth >= 768 && fallbackWidth < 992;
    const compact = typeof screens.lg === 'boolean' ? !screens.lg : fallbackWidth < 992;

    return {
      screens,
      mobile,
      tablet,
      compact,
      desktop: !mobile && !tablet,
    };
  }, [fallbackWidth, screens]);
}
