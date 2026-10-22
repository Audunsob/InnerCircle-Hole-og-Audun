'use client';

import dynamic from 'next/dynamic';

// The test mode keeps everything in the browser, like the app itself, so it renders only there.
const TestMode = dynamic(() => import('@/components/moderator/TestMode'), { ssr: false });

export function TestClient() {
  return <TestMode />;
}
