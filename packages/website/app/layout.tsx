import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import Providers from './providers';
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

export const metadata: Metadata = {
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh" suppressHydrationWarning>
      <head>
        <Script src="/initTheme.js" strategy="beforeInteractive" />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
