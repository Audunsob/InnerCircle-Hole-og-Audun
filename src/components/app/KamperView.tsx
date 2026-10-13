'use client';

import {
  hasResult,
  homeAway,
  matchPhotoCount,
  OUTCOME_COLOR,
  OUTCOME_WORD,
  outcomeOf,
  photoText,
  scoreText,
  splitMatches,
  visiblePosts,
} from '@/lib/derive';
import { fmtLong } from '@/lib/format';
import { matchTitle, opponentText, playerMap, seesTeamInfo, shortTeam } from '@/lib/selectors';
import { useStore } from '@/lib/store';
import type { Match } from '@/lib/types';
import { DateCol, Icon, SwitchRow, Tabs } from '../ui';
import { Rings } from '../screens/RoleScreen';
import { Feed } from './LagView';

function NotifyToggle({ id }: { id: string }) {
  const on = useStore((s) => !!s.notifyMatch[id]);
  const toggle = useStore((s) => s.toggleNotifyMatch);
  return (
    <div className="card" style={{ padding: '0 14px' }}>
      <SwitchRow label="Få varsel når det kommer bilder fra kampen" on={on} onToggle={() => toggle(id)} />
    </div>
  );
}

export function KamperView() {
  const st = useStore();
  const { data, role, kampTab } = st;
  const isCoach = role === 'coach';
  const { upcoming, past, next, later } = splitMatches(data.matches);
  const allowed = visiblePosts(st, data.posts, playerMap(data.players));

  return (
    <>
      <header className="app-header">
        <div className="app-title" style={{ flex: 1, minWidth: 0 }}>
          Kamper
        </div>
        {isCoach && (
          <button type="button" className="btn-outline" onClick={() => st.openAddMatch()}>
            + Legg til kamp
          </button>
        )}
      </header>
      <Tabs
        value={kampTab}
        items={[
          ['upcoming', 'Kommende'],
          ['played', 'Spilt'],
        ]}
        onChange={st.setKampTab}
      />

      {kampTab === 'upcoming' && (
        <>
          {next && <NextMatch m={next} />}
          {!upcoming.length && (
            <p className="note" style={{ padding: '40px 0', textAlign: 'center' }}>
              Ingen kommende kamper er lagt inn.
            </p>
          )}
          {later.length > 0 && (
            <section className="section">
              <h2 className="h2">Senere kamper</h2>
              <div className="list stagger">
                {later.map((m) => (
                  <div key={m.id} className="row">
                    <DateCol date={m.date} />
                    <div className="row-text">
                      <span style={{ font: 'italic 800 18px/1.15 var(--display)', textTransform: 'uppercase' }}>{matchTitle(st, m)}</span>
                      {opponentText(m) && <span className="row-sub">{opponentText(m)}</span>}
                      <span className="row-sub">
                        {m.time} · {m.venue}
                      </span>
                      <span className="row-meta">
                        {homeAway(m)} · {m.kind}
                      </span>
                      {isCoach && (
                        <button type="button" className="link-btn small start" style={{ minHeight: 0, padding: '4px 0 0' }} onClick={() => st.openAddMatch(m.id)}>
                          Endre kamp
                        </button>
                      )}
                    </div>
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label="Legg i kalender"
                      style={{ marginRight: -12, color: 'var(--accent-ink)' }}
                      onClick={() => st.addToCal(m)}
                    >
                      <Icon name="event" />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {kampTab === 'played' && (
        <>
          {!past.length && (
            <p className="note" style={{ padding: '40px 0', textAlign: 'center' }}>
              Ingen spilte kamper ennå.
            </p>
          )}
          <div className="stagger" style={{ paddingTop: 8 }}>
            {past.map((m) => {
              const o = outcomeOf(m);
              return (
                <div key={m.id} style={{ borderBottom: '1px solid var(--line)' }}>
                  <button type="button" className="row-btn" style={{ borderBottom: 'none', minHeight: 72 }} onClick={() => st.openMatchView(m.id)}>
                    <DateCol date={m.date} />
                    <span className="row-text">
                      <span style={{ font: 'italic 800 18px/1.15 var(--display)', textTransform: 'uppercase' }}>{matchTitle(st, m)}</span>
                      <span className="row-sub">
                        {opponentText(m) && opponentText(m) + ' · '}
                        {photoText(matchPhotoCount(allowed, m.id))} · {m.kind}
                      </span>
                    </span>
                    {o ? (
                      <>
                        <span className="tnum" style={{ font: 'italic 800 24px var(--display)' }}>
                          {scoreText(m)}
                        </span>
                        <span className="outcome" style={{ background: OUTCOME_COLOR[o] }}>
                          {o}
                        </span>
                      </>
                    ) : (
                      <span className="note">Ikke registrert</span>
                    )}
                  </button>
                  {isCoach && (
                    <div style={{ padding: '0 0 6px 56px', marginTop: -8, display: 'flex', gap: 16 }}>
                      <button type="button" className="link-btn small" onClick={() => st.openResult(m.id)}>
                        {hasResult(m) ? 'Endre resultat' : 'Legg inn resultat'}
                      </button>
                      <button type="button" className="link-btn small" onClick={() => st.openAddMatch(m.id)}>
                        Endre kamp
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}

function Crest({ text, us }: { text: string; us?: boolean }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: 58,
        height: 58,
        borderRadius: '50%',
        display: 'grid',
        placeItems: 'center',
        ...(us
          ? { background: '#0f0a0b', border: '1.5px solid var(--gold)', color: 'var(--gold)', font: '500 20px var(--serif)' }
          : { background: '#f5ede3', color: 'var(--brand)', font: '800 22px var(--display)' }),
      }}
    >
      {text}
    </span>
  );
}

function Side({ name, us }: { name: string; us: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, textAlign: 'center', minWidth: 0 }}>
      <Crest us={us} text={us ? 'IC' : name.trim().charAt(0).toUpperCase()} />
      <span style={{ font: 'italic 800 18px/1.05 var(--display)', textTransform: 'uppercase', overflowWrap: 'anywhere' }}>{name}</span>
    </div>
  );
}

function NextMatch({ m }: { m: Match }) {
  const st = useStore();
  const us = shortTeam(st);
  // Meeting time and the message to the team are for players and parents, not subscribers.
  const team = seesTeamInfo(st.role);
  const meet = team ? m.meet : '';
  const note = team ? m.note : '';
  return (
    <>
      <section className="brand-card" style={{ marginTop: 16, display: 'flex', flexDirection: 'column', animation: 'ic-rise 320ms var(--ease-out) both' }}>
        <Rings size={260} style={{ top: -110, right: -110 }} />
        <div style={{ position: 'relative', padding: '16px 16px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span className="eyebrow" style={{ color: 'var(--brand-accent)' }}>
            Neste kamp · {m.kind}
          </span>
          <span className="eyebrow" style={{ padding: '4px 10px', borderRadius: 10, background: 'rgba(15,10,11,.35)', color: 'var(--on-brand)', letterSpacing: '.14em' }}>
            {homeAway(m)}
          </span>
        </div>
        {m.opp ? (
          <div style={{ position: 'relative', padding: '18px 16px 4px', display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto minmax(0,1fr)', alignItems: 'center', gap: 8 }}>
            <Side name={m.home ? us : m.opp} us={m.home} />
            <span style={{ font: 'italic 800 26px var(--display)', color: 'var(--brand-accent)' }}>VS</span>
            <Side name={m.home ? m.opp : us} us={!m.home} />
          </div>
        ) : null}
        {(m.title || !m.opp) && (
          <h2 style={{ position: 'relative', margin: '14px 16px 0', font: 'italic 800 26px/1.05 var(--display)', textTransform: 'uppercase' }}>{matchTitle(st, m)}</h2>
        )}
        <div style={{ position: 'relative', margin: '14px 16px 0', display: 'grid', gridTemplateColumns: meet ? 'repeat(3,minmax(0,1fr))' : 'repeat(2,minmax(0,1fr))', gap: 8 }}>
          <Stat label="Dato" value={<span style={{ textTransform: 'capitalize' }}>{shortDate(m.date)}</span>} />
          <Stat label="Avspark" value={m.time} />
          {meet && <Stat label="Oppmøte" value={meet} />}
        </div>
        <div style={{ position: 'relative', margin: '12px 16px 0', display: 'flex', flexDirection: 'column', gap: 6, font: '400 14px/1.4 var(--body)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--on-brand-muted)' }}>
            <Icon name="location_on" size={18} style={{ color: 'var(--brand-accent)' }} />
            {m.venue}
          </span>
        </div>
        {note && (
          <p style={{ position: 'relative', margin: '12px 16px 0', padding: 12, borderRadius: 14, background: 'rgba(15,10,11,.35)', font: '400 14px/1.5 var(--body)', whiteSpace: 'pre-wrap' }}>
            {note}
          </p>
        )}
        <div className="btn-pair" style={{ position: 'relative', padding: '14px 16px 16px' }}>
          <button
            type="button"
            className="btn"
            style={{ border: 'none', background: 'var(--gold)', color: 'var(--on-gold)', font: '800 15px var(--display)', letterSpacing: '.12em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            onClick={() => st.addToCal(m)}
          >
            <Icon name="event" size={18} />
            Kalender
          </button>
          <button
            type="button"
            className="btn"
            style={{ border: '1px solid rgba(245,237,227,.4)', background: 'none', color: 'var(--on-brand)', font: '800 15px var(--display)', letterSpacing: '.12em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            onClick={() => st.showMap(m)}
          >
            <Icon name="location_on" size={18} />
            Vis kart
          </button>
        </div>
      </section>
      {st.role === 'coach' && (
        <button type="button" className="link-btn small start" style={{ marginTop: 6 }} onClick={() => st.openAddMatch(m.id)}>
          Endre eller slett kampen
        </button>
      )}
      <div style={{ marginTop: 10 }}>
        <NotifyToggle id={m.id} />
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ padding: 10, borderRadius: 14, background: 'rgba(15,10,11,.35)', display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
      <span style={{ font: '600 11px var(--body)', color: 'var(--on-brand-muted)' }}>{label}</span>
      <span className="tnum" style={{ font: '800 18px var(--display)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
        {value}
      </span>
    </div>
  );
}

function shortDate(date: string) {
  const d = new Date(date + 'T12:00');
  const wk = d.toLocaleDateString('nb-NO', { weekday: 'short' }).replace('.', '');
  return wk + ' ' + d.getDate() + '.' + (d.getMonth() + 1);
}

export function MatchDetail({ id }: { id: string }) {
  const st = useStore();
  const m = st.data.matches.find((x) => x.id === id);
  if (!m) return null;
  const P = playerMap(st.data.players);
  const allowed = visiblePosts(st, st.data.posts, P);
  const o = outcomeOf(m);
  return (
    <>
      <header className="app-header">
        <button
          type="button"
          onClick={st.closeMatch}
          style={{
            minHeight: 48,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginLeft: -8,
            padding: '0 8px',
            border: 'none',
            background: 'none',
            color: 'var(--ink)',
            font: '700 14px var(--display)',
            letterSpacing: '.14em',
            textTransform: 'uppercase',
            cursor: 'pointer',
          }}
        >
          <Icon name="arrow_back" />
          Spilte kamper
        </button>
      </header>
      <section className="card" style={{ position: 'relative', overflow: 'hidden', padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: 12, animation: 'ic-rise 320ms var(--ease-out) both' }}>
        <Rings size={260} style={{ top: -100, right: -100 }} />
        <div className="eyebrow" style={{ position: 'relative', color: 'var(--muted)', textTransform: 'uppercase' }}>
          {fmtLong(m.date)} · {homeAway(m)} · {m.kind}
        </div>
        {o && m.opp ? (
          <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto minmax(0,1fr)', alignItems: 'center', gap: 6 }}>
            <span style={{ font: 'italic 800 20px/1.05 var(--display)', textTransform: 'uppercase', textAlign: 'center', overflowWrap: 'anywhere', color: m.home ? 'var(--ink)' : 'var(--muted)' }}>
              {m.home ? shortTeam(st) : m.opp}
            </span>
            <span className="tnum" style={{ font: 'italic 800 72px/0.9 var(--display)', animation: 'ic-pop 520ms var(--ease-out) 120ms both' }}>
              <span style={{ color: m.home ? 'var(--gold)' : 'inherit' }}>{m.home ? m.us : m.them}</span>
              <span style={{ color: 'var(--muted)' }}>–</span>
              <span style={{ color: m.home ? 'inherit' : 'var(--gold)' }}>{m.home ? m.them : m.us}</span>
            </span>
            <span style={{ font: 'italic 800 20px/1.05 var(--display)', textTransform: 'uppercase', textAlign: 'center', overflowWrap: 'anywhere', color: m.home ? 'var(--muted)' : 'var(--ink)' }}>
              {m.home ? m.opp : shortTeam(st)}
            </span>
          </div>
        ) : (
          <>
            <h1 className="h1" style={{ position: 'relative' }}>
              {matchTitle(st, m)}
            </h1>
            {o && (
              <span className="tnum" style={{ position: 'relative', font: 'italic 800 56px/0.9 var(--display)' }}>
                {scoreText(m)}
              </span>
            )}
          </>
        )}
        {o && m.opp
          ? m.title && <div style={{ position: 'relative', font: 'italic 800 18px var(--display)', textTransform: 'uppercase', textAlign: 'center' }}>{m.title}</div>
          : opponentText(m) && <div style={{ position: 'relative', font: '600 15px var(--body)' }}>{opponentText(m)}</div>}
        {o && (
          <div style={{ position: 'relative', display: 'flex', justifyContent: o && m.opp ? 'center' : 'flex-start' }}>
            <span
              className="eyebrow"
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 14, background: OUTCOME_COLOR[o], color: '#fff', fontSize: 14, letterSpacing: '.18em' }}
            >
              {OUTCOME_WORD[o]}
            </span>
          </div>
        )}
        {m.note && seesTeamInfo(st.role) && (
          <p style={{ position: 'relative', margin: 0, font: '400 14px/1.5 var(--body)', color: 'var(--muted)', whiteSpace: 'pre-wrap', textAlign: o && m.opp ? 'center' : 'left' }}>{m.note}</p>
        )}
      </section>
      <div style={{ margin: '12px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span className="note" style={{ flex: 1 }}>
          {photoText(matchPhotoCount(allowed, m.id))} fra kampen
        </span>
        {st.role === 'coach' && (
          <>
            <button type="button" className="link-btn small" onClick={() => st.openAddMatch(m.id)}>
              Endre kamp
            </button>
            <button type="button" className="btn-outline" onClick={() => st.openResult(m.id)}>
              {hasResult(m) ? 'Endre resultat' : 'Legg inn resultat'}
            </button>
          </>
        )}
      </div>
      <NotifyToggle id={m.id} />
      <Feed posts={allowed.filter((p) => p.matchId === m.id)} P={P} emptyText="Ingen bilder fra denne kampen ennå." />
    </>
  );
}
