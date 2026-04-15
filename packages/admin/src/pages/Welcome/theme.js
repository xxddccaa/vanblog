import { useModel } from '@umijs/max';
import { useMemo } from 'react';

export const WELCOME_CHART_COLORS = {
  primary: ['#667eea', '#764ba2'],
  accent: ['#f093fb', '#f5576c'],
  cyan: ['#4facfe', '#00f2fe'],
  success: ['#43e97b', '#38f9d7'],
};

export const useWelcomeThemePalette = () => {
  const { initialState } = useModel('@@initialState');

  return useMemo(() => {
    const navTheme = initialState?.settings?.navTheme || 'light';
    const isDark = initialState?.theme === 'dark' || navTheme.toLowerCase().includes('dark');

    return {
      isDark,
      textPrimary: isDark ? '#e5eefb' : '#2c3e50',
      textSecondary: isDark ? '#cbd5e1' : '#5a6c7d',
      textTertiary: isDark ? '#94a3b8' : '#7f8c8d',
      link: isDark ? '#93c5fd' : '#667eea',
      progressTrail: isDark ? 'rgba(148, 163, 184, 0.16)' : '#f5f5f5',
      chartLabel: isDark ? '#cbd5e1' : '#5a6c7d',
      chartGrid: isDark ? 'rgba(148, 163, 184, 0.18)' : 'rgba(0, 0, 0, 0.08)',
      chartAreaBase: isDark ? '#0f172a' : '#ffffff',
      statisticText: isDark ? '#f8fafc' : '#2c3e50',
      badgeNeutralBg: isDark ? 'rgba(148, 163, 184, 0.16)' : '#f0f0f0',
      badgeNeutralText: isDark ? '#dbe4f0' : '#999999',
      roseLabel: isDark ? '#e2e8f0' : '#ffffff',
    };
  }, [initialState?.theme, initialState?.settings?.navTheme]);
};

export const getWelcomeAreaFill = (startColor, endColor, palette) =>
  palette.isDark
    ? `l(270) 0:${palette.chartAreaBase} 0.45:${startColor} 1:${endColor}`
    : `l(270) 0:#ffffff 0.5:${startColor} 1:${endColor}`;

export const getWelcomeAxisStyle = (palette, withGrid = false) => ({
  label: {
    style: {
      fill: palette.chartLabel,
      fontSize: 12,
    },
  },
  line: {
    style: {
      stroke: palette.chartGrid,
    },
  },
  tickLine: {
    style: {
      stroke: palette.chartGrid,
    },
  },
  grid: withGrid
    ? {
        line: {
          style: {
            stroke: palette.chartGrid,
            lineDash: [4, 4],
          },
        },
      }
    : undefined,
});

export const getWelcomeLegendStyle = (palette, extra = {}) => ({
  itemName: {
    style: {
      fill: palette.textSecondary,
    },
  },
  itemValue: {
    style: {
      fill: palette.textTertiary,
    },
  },
  ...extra,
});
