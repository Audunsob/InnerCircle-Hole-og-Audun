'use client';

import { fmtToday } from '@/lib/format';
import { teamName } from '@/lib/selectors';
import { useStore } from '@/lib/store';
import { Field, KeyValues, RadioOptions, SignaturePad, TopBar } from '../ui';

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="bullets">
      {items.map((t) => (
        <li key={t}>{t}</li>
      ))}
    </ul>
  );
}

const PARENT_POINTS = [
  'Bildene og videoene vises kun til personer som er invitert av spillerne på laget, for eksempel besteforeldre og annen familie. De betaler et månedlig beløp for å følge laget, og pengene går til laget.',
  'Ingen bilder eller videoer publiseres på åpne nettsider eller sosiale medier.',
  'Det tas aldri bilder i garderoben eller dusjen.',
  'Det er frivillig å samtykke. Spilleren kan si nei selv om foresatte har gitt tillatelse.',
  'Samtykket kan trekkes tilbake når som helst ved å kontakte administratoren. Dersom samtykket trekkes tilbake, slettes bilder og videoer av spilleren så langt det er mulig.',
];

const PLAYER_POINTS = [
  'Bildene vises bare for folk som er invitert av spillerne på laget, som besteforeldre og annen familie. De betaler litt hver måned for å følge laget, og pengene går til laget.',
  'Ingen bilder legges ut på åpne nettsider eller sosiale medier.',
  'Vi tar aldri bilder i garderoben eller dusjen.',
  'Sier du nei, er det helt greit. Du er like mye med på laget, og administratorene passer på at du ikke er med på bildene.',
];

/**
 * Player consent, answered once. 15 or older: one signed page. Under 15: part 1 for the player and
 * part 2 for a parent, filled in together on the player's phone.
 */
export function PlayerConsent() {
  const st = useStore();
  const c = st.pcons || { step: 1, p: null, ps: null, err: '' };
  const minor = !c.adult;
  const player = st.data.players.find((p) => p.id === st.prof.player.playerId);
  const meta: [string, React.ReactNode][] = [
    ['Spiller', <span key="n" style={{ fontWeight: 600 }}>{player?.name || ''}</span>],
    ['Dato', <span key="d" className="tnum">{fmtToday()}</span>],
  ];
  const last = c.step === 2 || !minor || c.p === 'no';
  const incomplete =
    c.step === 1 ? !c.p || (c.p === 'yes' && !c.ps) : !c.g || (c.g === 'yes' && (!c.gs || !(c.gn || '').trim()));
  const btn = last ? (c.step === 2 ? (c.g === 'yes' ? 'Send inn' : 'Fullfør') : c.p === 'yes' ? 'Send inn' : 'Fullfør') : 'Neste';

  return (
    <div className="fullscreen">
      <div className="fullscreen-inner">
        <TopBar label={minor ? 'Samtykke · del ' + c.step + ' av 2' : 'Samtykke'} onBack={st.pcBack} />
        {minor && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
            <span style={{ height: 3, background: 'var(--accent)' }} />
            <span style={{ height: 3, background: c.step === 2 ? 'var(--accent)' : 'var(--line)' }} />
          </div>
        )}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 18, paddingTop: 24 }}>
          {c.step === 1 && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {minor && <span style={{ font: '600 13px var(--body)', color: 'var(--accent-ink)' }}>Del 1</span>}
                <h1 className="h1">{minor ? 'Til deg som spiller' : 'Samtykke til bilder og video'}</h1>
              </div>
              <KeyValues rows={meta} />
              <p className="body-text">
                Laget ditt bruker InnerCircle. Det er en lukket app der familie og venner kan se bilder og korte videoer fra treninger og
                kamper. Før vi tar bilder av deg og legger dem ut, spør vi deg. Du svarer én gang, og svaret gjelder alle bildene.
              </p>
              <Bullets
                items={[
                  ...PLAYER_POINTS,
                  minor
                    ? 'Du kan ombestemme deg når som helst. Si fra til administratoren eller foreldrene dine, så slettes bildene der du er med.'
                    : 'Du kan ombestemme deg når som helst. Si fra til administratoren, så slettes bildene der du er med.',
                ]}
              />
              {minor && (
                <p className="note">
                  Er du under 15, må en foresatt også signere. Skjemaet har to deler: du fyller ut del 1, og en foresatt fyller ut del 2 på
                  samme telefon. Sier du nei, gjelder det selv om foresatte sier ja.
                </p>
              )}
              <div style={{ borderTop: '1px solid var(--line)', paddingTop: 18 }}>
                <RadioOptions
                  value={c.p}
                  onChange={(v) => st.setPC({ p: v })}
                  options={[
                    { value: 'yes', label: 'Ja, jeg vil gjerne være med på bilder og video' },
                    { value: 'no', label: 'Nei, jeg vil ikke være med' },
                  ]}
                />
              </div>
              {c.p === 'yes' && <SignaturePad key="p" label="Signatur, spiller" value={c.ps} onChange={(v) => st.setPC({ ps: v })} />}
            </>
          )}
          {c.step === 2 && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ font: '600 13px var(--body)', color: 'var(--accent-ink)' }}>Del 2</span>
                <h1 className="h1">Til foresatte</h1>
              </div>
              <KeyValues rows={meta} />
              <p className="body-text">
                {player ? player.name.split(' ')[0] : 'Spilleren'} har sagt ja til å være med på bilder og video i InnerCircle, en lukket app der
                familie og venner kan se bilder og korte videoer fra treninger og kamper. Fordi spilleren er under 15 år, trenger vi også
                samtykke fra en foresatt.
              </p>
              <Bullets items={PARENT_POINTS} />
              <div style={{ borderTop: '1px solid var(--line)', paddingTop: 18 }}>
                <RadioOptions
                  value={c.g ?? null}
                  onChange={(v) => st.setPC({ g: v })}
                  options={[
                    { value: 'yes', label: 'Ja, jeg er foresatt og godkjenner at barnet mitt er med på bilder og video' },
                    { value: 'no', label: 'Nei, jeg godkjenner ikke at barnet mitt er med' },
                  ]}
                />
              </div>
              {c.g === 'yes' && (
                <>
                  <Field label="Navnet ditt">
                    <input className="input" value={c.gn || ''} onChange={(e) => st.setPC({ gn: e.target.value })} autoComplete="name" />
                  </Field>
                  <SignaturePad key="g" label="Signatur, foresatt" value={c.gs ?? null} onChange={(v) => st.setPC({ gs: v })} />
                </>
              )}
            </>
          )}
          {c.err && (
            <p role="alert" className="error">
              {c.err}
            </p>
          )}
        </div>
        <div className="sticky-action">
          <button type="button" className={'btn btn-primary btn-block' + (incomplete || c.busy ? ' btn-dim' : '')} onClick={() => !c.busy && st.pcNext()}>
            {c.busy ? 'Lagrer …' : btn}
          </button>
        </div>
      </div>
    </div>
  );
}

const COACH_RULES = [
  'Du legger bare ut portrettbilder og videoer av spillere som har gitt samtykke. Sjekk samtykkelisten i appen før du publiserer.',
  'Spillere som har sagt nei eller ikke har svart, skal ikke være med på bildene. Er spilleren under 15 år, må også en foresatt ha signert. Spillerens nei gjelder selv om foresatte har sagt ja.',
  'Det tas aldri bilder i garderoben eller dusjen, og ingen bilder der noen er skadet eller lei seg.',
  'Bildene og videoene vises kun til personer som er invitert av spillerne på laget, og du sletter stygge kommentarer.',
  'Ingen bilder eller videoer publiseres på åpne nettsider eller sosiale medier.',
  'Hvis en spiller eller foresatt trekker samtykket, sletter du bildene av spilleren snarest mulig.',
  'Når du slutter som administrator, sier du fra til klubben og gir beskjed til den nye administratoren om hvem som har sagt nei.',
  'Oppretter du laget, bekrefter du også at klubben har godkjent at laget bruker InnerCircle, og at samtykke er samlet inn før det første bildet legges ut.',
  'Det er klubben som er ansvarlig for bildene, men du står ansvarlig for at reglene blir fulgt på laget ditt. Brudd på reglene kan føre til at du mister tilgangen.',
];

/** Rules every coach signs, both when creating a team and when joining one. */
export function CoachConsent() {
  const st = useStore();
  const c = st.pcons || { step: 1, p: null, ps: null, err: '' };
  const name = st.flow.coachName.trim() || st.flow.contact || '';
  const team = c.mode === 'create' ? c.pending?.n || '' : st.flow.peek?.teamName || teamName(st);
  const incomplete = !c.p || (c.p === 'yes' && !c.ps);
  return (
    <div className="fullscreen">
      <div className="fullscreen-inner">
        <TopBar label="Administrator · Samtykke" onBack={st.ccBack} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 18, paddingTop: 16 }}>
          <h1 className="h1">Samtykke og ansvar for administratorer</h1>
          <KeyValues
            rows={[
              ['Administrator', name],
              ['Lag', team],
              ['Dato', fmtToday()],
            ]}
          />
          <p className="body-text">
            Laget ditt bruker InnerCircle, en lukket app der familie og venner kan se bilder og korte videoer fra treninger og kamper. Som administrator
            er det du som legger ut bildene, og du står ansvarlig for at reglene under blir fulgt. Alle administratorer må
            godkjenne dette, både den som oppretter laget og alle som logger inn senere.
          </p>
          <Bullets items={COACH_RULES} />
          <p className="body-text">Vennligst les reglene og velg ett av alternativene nedenfor.</p>
          <div style={{ borderTop: '1px solid var(--line)', paddingTop: 18 }}>
            <RadioOptions
              value={c.p}
              onChange={(v) => st.setPC({ p: v })}
              options={[
                { value: 'yes', label: 'Ja, jeg godtar reglene og står ansvarlig for at de blir fulgt' },
                { value: 'no', label: 'Nei, jeg godtar ikke reglene (da får du ikke tilgang til laget)' },
              ]}
            />
          </div>
          {c.p === 'yes' && <SignaturePad label="Signatur, administrator" value={c.ps} onChange={(v) => st.setPC({ ps: v })} />}
          {c.err && (
            <p role="alert" className="error">
              {c.err}
            </p>
          )}
        </div>
        <div className="sticky-action">
          <button type="button" className={'btn btn-primary btn-block' + (incomplete || c.busy ? ' btn-dim' : '')} onClick={st.ccNext}>
            {c.busy ? 'Lagrer …' : c.p === 'no' ? 'Avslutt' : 'Godta og fortsett'}
          </button>
        </div>
      </div>
    </div>
  );
}
