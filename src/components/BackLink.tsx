'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { isDemo } from '@/lib/supabase';

/** "Tilbake til InnerCircle". From the demo at /demo it goes back there, not into the real app. */
export function BackLink() {
  const router = useRouter();
  return (
    <Link
      href="/"
      onNavigate={(e) => {
        if (!isDemo()) return;
        e.preventDefault();
        router.push('/demo');
      }}
      className="link-btn start"
      style={{ alignSelf: 'flex-start', padding: 0 }}
    >
      ← Tilbake til InnerCircle
    </Link>
  );
}
