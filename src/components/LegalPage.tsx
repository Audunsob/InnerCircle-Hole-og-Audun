import type { ReactNode } from 'react';
import { CONTACT_EMAIL, LEGAL_UPDATED } from '@/lib/legal';
import { BackLink } from './BackLink';

/** Shared frame for the privacy policy and the terms: a plain, readable page with a way back to the app. */
export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="screen" style={{ padding: '24px 20px 48px', gap: 20 }}>
      <BackLink />
      <h1 className="h1">{title}</h1>
      <p className="note">Sist oppdatert {LEGAL_UPDATED}</p>
      {children}
    </main>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="section" style={{ paddingTop: 8 }}>
      <h2 className="h2">{title}</h2>
      {children}
    </section>
  );
}

/** How to reach whoever answers questions about data: the email when there is one, otherwise the coach. */
export function Contact() {
  return CONTACT_EMAIL ? (
    <>
      Skriv til <a href={'mailto:' + CONTACT_EMAIL}>{CONTACT_EMAIL}</a>.
    </>
  ) : (
    <>Kontakt administratoren på laget ditt, så sender de spørsmålet videre.</>
  );
}
