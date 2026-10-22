import type { Metadata } from 'next';
import { TestClient } from './TestClient';

// The test mode for moderators: the whole app against made-up data in the browser. Kept out of search engines.
export const metadata: Metadata = {
  title: 'InnerCircle',
  robots: { index: false, follow: false },
};

export default function Page() {
  return <TestClient />;
}
