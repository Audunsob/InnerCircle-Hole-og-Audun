import type { Metadata, Viewport } from 'next';
import { Bodoni_Moda, Inter } from 'next/font/google';
import { LS_KEY } from '@/lib/seed';
import './globals.css';

// The InnerCircle wordmark, matching the serif in the logo.
const bodoni = Bodoni_Moda({
  variable: '--font-bodoni',
  subsets: ['latin', 'latin-ext'],
  style: ['normal', 'italic'],
});

// Text uses the phone's own system font (San Francisco on iPhone). Inter is the fallback elsewhere.
const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin', 'latin-ext'],
});

export const metadata: Metadata = {
  title: 'InnerCircle',
  description: 'Lagets egen bildestrøm, bare for familien.',
  icons: { icon: '/icon-192.png', apple: '/apple-touch-icon.png' },
  appleWebApp: { capable: true, title: 'InnerCircle', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f2f2f7' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
  ],
};

// Apply the saved theme (light by default) before first paint to avoid a light flash.
const themeScript = `(function(){try{var s=JSON.parse(localStorage.getItem(${JSON.stringify(LS_KEY)})||'null');var t=s&&s.theme==='dark'?'dark':'light';document.documentElement.setAttribute('data-theme',t)}catch(e){}})()`;

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="nb" data-theme="light" className={`${bodoni.variable} ${inter.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {/* Icon font. display=block avoids flashing ligature names before it loads. */}
        {/* eslint-disable-next-line @next/next/google-font-display, @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,400,0..1,0&display=block"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
