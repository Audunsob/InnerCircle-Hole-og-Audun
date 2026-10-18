import type { Metadata } from 'next';
import { ModeratorClient } from './ModeratorClient';

// Not linked from anywhere, and kept out of search engines. The database decides who sees anything.
export const metadata: Metadata = {
  title: 'InnerCircle',
  robots: { index: false, follow: false },
  manifest: '/moderator.webmanifest',
};

export default function Page() {
  return <ModeratorClient />;
}
