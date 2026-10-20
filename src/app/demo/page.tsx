import type { Metadata } from 'next';
import { DemoClient } from './DemoClient';

// The link behind the QR code at the pitch. Made-up data only, and nothing can be changed.
export const metadata: Metadata = {
  title: 'InnerCircle · Demo',
  robots: { index: false, follow: false },
};

export default function Page() {
  return <DemoClient />;
}
