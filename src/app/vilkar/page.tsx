import type { Metadata } from 'next';
import Link from 'next/link';
import { Contact, LegalPage, LegalSection } from '@/components/LegalPage';

export const metadata: Metadata = { title: 'Vilkår · InnerCircle' };

export default function Page() {
  return (
    <LegalPage title="Vilkår for bruk">
      <p className="body-text">Når du bruker InnerCircle, godtar du dette.</p>

      <LegalSection title="Bildene er private">
        <ul className="bullets">
          <li>Bildene og videoene er bare for deg. Ikke del, last ned for å spre eller legg dem ut andre steder.</li>
          <li>Spillerne, og foresatte for spillere under 15 år, har gitt samtykke til at bildene vises i InnerCircle, ikke til at de spres videre.</li>
          <li>Ikke gi lagkoden eller kontoen din til andre enn dem den er ment for.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Administratorer">
        <ul className="bullets">
          <li>Administratoren er ansvarlig for det som legges ut på laget.</li>
          <li>Legg bare ut bilder av spillere som har samtykket. Legg aldri ut bilder som kan være krenkende eller som en spiller eller foresatt har bedt deg fjerne.</li>
          <li>Godkjenn bare spillere du vet hvem er.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Abonnement">
        <ul className="bullets">
          <li>Abonnementet fornyes hver måned til du sier det opp på Min side.</li>
          <li>Du ser bildene ut perioden du har betalt for. Det du har betalt, går til laget og betales ikke tilbake.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Avslutte">
        <ul className="bullets">
          <li>Du kan forlate et lag eller slette kontoen din når som helst på Min side.</li>
          <li>Administratoren kan fjerne deg fra laget, for eksempel hvis vilkårene ikke følges.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Endringer og spørsmål">
        <p className="body-text">
          Hvis vilkårene endres, står det her med ny dato. <Contact />
        </p>
        <p className="note">
          Se også <Link href="/personvern">personvernerklæringen</Link>.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
