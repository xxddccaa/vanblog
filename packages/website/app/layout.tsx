import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import Providers from './providers';
import { getPublicMeta } from '../api/getAllData';
import '../styles/globals.css';
import '../styles/side-bar.css';
import '../styles/toc.css';
import '../styles/var.css';
import '../styles/github-markdown.css';
import '../styles/tip-card.css';
import '../styles/loader.css';
import '../styles/scrollbar.css';
import '../styles/custom-container.css';
import '../styles/code-light.css';
import '../styles/code-dark.css';
import '../styles/zoom.css';
import { getLayoutProps } from '../utils/getLayoutProps';
import { resolveFrontCardSurfaceColors } from '../utils/frontCardSurface';
import {
  getThemeBootstrapScript,
  getThemeSnapshot,
  normalizeThemePreference,
} from '../utils/themeBoot';

export const metadata: Metadata = {
};

export const dynamic = 'force-dynamic';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  userScalable: false,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const publicMeta = await getPublicMeta();
  const layoutProps = getLayoutProps(publicMeta);
  const defaultTheme = layoutProps.defaultTheme;
  const frontCardSurfaces = resolveFrontCardSurfaceColors({
    frontCardBackgroundColor: layoutProps.frontCardBackgroundColor,
    frontCardBackgroundColorDark: layoutProps.frontCardBackgroundColorDark,
  });
  const requestHeaders = await headers();
  const initialTheme = getThemeSnapshot({
    defaultTheme,
    lightBackground: frontCardSurfaces.lightDeep,
    darkBackground: frontCardSurfaces.darkPage,
    preferredTheme: normalizeThemePreference(requestHeaders.get('x-vanblog-theme')),
  });

  return (
    <html
      lang="zh"
      suppressHydrationWarning
      className={initialTheme.className}
      data-theme={initialTheme.dataTheme}
      style={{
        colorScheme: initialTheme.colorScheme,
        ['--vb-front-card-bg-light' as string]: frontCardSurfaces.light,
        ['--vb-front-card-bg-light-soft' as string]: frontCardSurfaces.lightSoft,
        ['--vb-front-card-bg-light-deep' as string]: frontCardSurfaces.lightDeep,
        ['--vb-front-card-bg-dark' as string]: frontCardSurfaces.dark,
        ['--vb-front-card-bg-dark-soft' as string]: frontCardSurfaces.darkSoft,
        ['--vb-front-card-bg-dark-deep' as string]: frontCardSurfaces.darkDeep,
        ['--vb-front-page-bg-light' as string]: frontCardSurfaces.lightDeep,
        ['--vb-front-page-bg-dark' as string]: frontCardSurfaces.darkPage,
        ['--vb-front-dark-hover' as string]: frontCardSurfaces.darkHover,
        ['--vb-front-dark-hover-soft' as string]: frontCardSurfaces.darkHoverSoft,
        ['--vb-front-dark-border' as string]: frontCardSurfaces.darkBorder,
        ['--vb-front-dark-border-strong' as string]: frontCardSurfaces.darkBorderStrong,
        ['--vb-front-dark-text' as string]: frontCardSurfaces.darkText,
        ['--vb-front-dark-text-muted' as string]: frontCardSurfaces.darkTextMuted,
        ['--vb-front-dark-text-soft' as string]: frontCardSurfaces.darkTextSoft,
        ['--vb-front-dark-text-strong' as string]: frontCardSurfaces.darkTextStrong,
        ['--vb-front-dark-text-on-accent' as string]: frontCardSurfaces.darkTextOnAccent,
        ['--vb-front-dark-fill' as string]: frontCardSurfaces.darkFill,
      }}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: getThemeBootstrapScript(defaultTheme, {
              lightBackground: frontCardSurfaces.lightDeep,
              darkBackground: frontCardSurfaces.darkPage,
            }),
          }}
        />
      </head>
      <body
        suppressHydrationWarning
        className={initialTheme.bodyClassName}
        data-theme={initialTheme.bodyDataTheme}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
