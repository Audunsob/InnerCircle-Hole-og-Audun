'use client';

import dynamic from 'next/dynamic';

// The store reads the browser on load, like the app itself, so this renders only there.
const DemoApp = dynamic(() => import('@/components/demo/DemoApp'), { ssr: false });

export function DemoClient() {
  return <DemoApp />;
}
