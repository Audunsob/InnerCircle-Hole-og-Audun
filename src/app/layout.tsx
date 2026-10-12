import type { Metadata, Viewport } from 'next';
import { Barlow_Condensed, Bodoni_Moda, DM_Sans } from 'next/font/google';
import { LS_KEY } from '@/lib/seed';
import './globals.css';

// Headings, scores and labels: condensed and sporty.
const barlow = Barlow_Condensed({
  variable: '--font-barlow',
  subsets: ['latin', 'latin-ext'],
  weight: ['600', '700', '800'],
  style: ['normal', 'italic'],
});

// The InnerCircle wordmark, matching the serif in the logo.
const bodoni = Bodoni_Moda({
  variable: '--font-bodoni',
  subsets: ['latin', 'latin-ext'],
  style: ['normal', 'italic'],
});

const dmSans = DM_Sans({
  variable: '--font-dm-sans',
  subsets: ['latin', 'latin-ext'],
  axes: ['opsz'],
});

export const metadata: Metadata = {
  title: 'InnerCircle',
  description: 'Lagets egen bildestrøm, bare for familien.',
  icons: { icon: '/icon-192.png', apple: '/apple-touch-icon.png' },
  appleWebApp: { capable: true, title: 'InnerCircle', statusBarStyle: 'black' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0f0a0b',
};

// Apply the saved theme (dark by default) before first paint to avoid a light flash.
const themeScript = `(function(){try{var s=JSON.parse(localStorage.getItem(${JSON.stringify(LS_KEY)})||'null');var t=s&&s.theme==='light'?'light':'dark';document.documentElement.setAttribute('data-theme',t)}catch(e){}})()`;

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="nb" data-theme="light" className={`${barlow.variable} ${bodoni.variable} ${dmSans.variable}`} suppressHydrationWarning>
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
