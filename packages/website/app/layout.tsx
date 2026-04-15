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
  const defaultTheme = getLayoutProps(publicMeta).defaultTheme;
  const requestHeaders = await headers();
  const initialTheme = getThemeSnapshot({
    defaultTheme,
    preferredTheme: normalizeThemePreference(requestHeaders.get('x-vanblog-theme')),
  });

  return (
    <html
      lang="zh"
      suppressHydrationWarning
      className={initialTheme.className}
      data-theme={initialTheme.dataTheme}
      style={{
        backgroundColor: initialTheme.backgroundColor,
        colorScheme: initialTheme.colorScheme,
      }}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: getThemeBootstrapScript(defaultTheme),
          }}
        />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
