'use client';

import dynamic from 'next/dynamic';

// Reads the login from the browser, like the app itself, so it renders only there.
const ModeratorApp = dynamic(() => import('@/components/moderator/ModeratorApp'), { ssr: false });

export function ModeratorClient() {
  return <ModeratorApp />;
}
