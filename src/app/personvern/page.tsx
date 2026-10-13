import type { Metadata } from 'next';
import Link from 'next/link';
import { Contact, LegalPage, LegalSection } from '@/components/LegalPage';

export const metadata: Metadata = { title: 'Personvern · InnerCircle' };

export default function Page() {
  return (
    <LegalPage title="Personvern">
      <p className="body-text">
        InnerCircle er en privat bildestrøm for et idrettslag. Her står hvilke opplysninger appen lagrer, hvem som ser dem, og hvordan du får dem slettet.
      </p>

      <LegalSection title="Hva vi lagrer">
        <ul className="bullets">
          <li>E-postadressen du logger inn med.</li>
          <li>Hvilke lag du er med på, og som hva: administrator, spiller eller abonnent.</li>
          <li>Navn og draktnummer på spillerne, lagt inn av administratoren.</li>
          <li>Bilder, videoer og tekst som legges ut på laget.</li>
          <li>Samtykker og signaturer fra spillere, foresatte (for spillere under 15 år) og administratorer. For spillere under 15 år lagres også navnet til den foresatte som signerte.</li>
          <li>Hjertene du gir, og navnet du oppgir som abonnent.</li>
          <li>Abonnement og betalinger: beløp og dato. Kortnummer lagres ikke i InnerCircle.</li>
          <li>Adressen telefonen din bruker for varsler, hvis du har slått på varsler.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Hvorfor">
        <ul className="bullets">
          <li>For å gi deg tilgang til laget ditt og holde kontoen din i gang.</li>
          <li>Bare spillere som har sagt ja, kan være med på bilder og video. Under 15 år må også en foresatt ha signert samtykket.</li>
          <li>Betalinger tas vare på fordi laget må føre regnskap.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Hvem ser hva">
        <p className="body-text">
          Ingenting er offentlig. Bare de som er med på laget, ser innleggene. Bildene ligger i en privat mappe for laget og åpnes bare med lenker som
          slutter å virke etter en time. Administratorene ser e-posten til kontoer som er koblet til en spiller, slik at de kan godkjenne dem.
        </p>
        <p className="body-text">
          Opplysningene lagres hos leverandørene som driver appen: Supabase (database, innlogging og filer) og leverandøren som kjører nettsiden. De
          bruker ikke opplysningene til noe eget.
        </p>
      </LegalSection>

      <LegalSection title="Hvor lenge">
        <ul className="bullets">
          <li>Kontoen din lagres til du sletter den.</li>
          <li>Når du forlater et lag, fjernes koblingen din til laget, hjertene dine og abonnementet ditt der.</li>
          <li>Bilder og videoer slettes fra lagringen når administratoren sletter innlegget eller fjerner bildet fra innlegget.</li>
          <li>Betalinger beholdes så lenge regnskapsreglene krever, vanligvis fem år.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Dine rettigheter">
        <ul className="bullets">
          <li>
            <strong>Slette kontoen:</strong> Min side → Slett kontoen.
          </li>
          <li>
            <strong>Forlate et lag:</strong> Min side → Forlat laget.
          </li>
          <li>
            <strong>Trekke samtykke:</strong> Min side → Samtykke. Innlegg der spilleren er merket, skjules med en gang.
          </li>
          <li>
            <strong>Innsyn og retting:</strong> Du kan be om å få se hva som er lagret om deg, og få rettet feil. <Contact />
          </li>
          <li>
            Du kan klage til Datatilsynet hvis du mener opplysningene dine blir behandlet feil (
            <a href="https://www.datatilsynet.no" target="_blank" rel="noreferrer">
              datatilsynet.no
            </a>
            ).
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Spørsmål">
        <p className="body-text">
          <Contact />
        </p>
        <p className="note">
          Se også <Link href="/vilkar">vilkårene for bruk</Link>.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
