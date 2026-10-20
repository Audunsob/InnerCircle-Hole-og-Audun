'use client';

import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { isEmail, rel } from '@/lib/format';
import { ROLES } from '@/lib/seed';
import { useStore, type Store } from '@/lib/store';
import {
  currentSession,
  isModerator,
  modOverview,
  modViewAs,
  sendCode,
  setViewAs,
  verifyCode,
  type MemberRole,
  type ModOverview,
  type ModTeam,
  type ModUser,
  type ModViewAs,
} from '@/lib/supabase';
import { AppShell } from '../app/AppShell';
import { Viewer } from '../overlays/Viewer';
import { SheetHost } from '../sheets/Sheets';
import { Icon, Tabs } from '../ui';

/**
 * The page at /moderator for the people who made the app. Nothing in the app links here. Anyone the
 * database doesn't know as a moderator gets what looks like Next.js's own "page not found", and only
 * /moderator?inn offers a login. Everything shown is read only.
 */
export default function ModeratorApp() {
  const [state, setState] = useState<'loading' | 'nope' | 'login' | 'ready'>('loading');
  const [data, setData] = useState<ModOverview | null>(null);
  const [viewing, setViewing] = useState<{ v: ModViewAs; label: string; saved: Store } | null>(null);
  const [err, setErr] = useState('');

  const load = async () => {
    try {
      if (!(await isModerator())) return setState('nope');
      setData(await modOverview());
      setState('ready');
    } catch {
      // Not a moderator, or a database without the moderator functions yet.
      setState('nope');
    }
  };

  useEffect(() => {
    void (async () => {
      const session = await currentSession();
      if (session) return load();
      setState(new URLSearchParams(window.location.search).has('inn') ? 'login' : 'nope');
    })();
  }, []);

  useEffect(() => {
    document.title = state === 'nope' ? '404: This page could not be found.' : 'InnerCircle';
  }, [state]);

  const viewAs = async (teamId: string, role: MemberRole, user: ModUser | null, label: string) => {
    setErr('');
    try {
      const v = await modViewAs(teamId, role, user?.id ?? null);
      const saved = useStore.getState();
      const live = user ? user.teams.some((t) => t.teamId === teamId && t.role === 'sub' && t.live) : true;
      setViewAs(v);
      useStore.setState({
        uid: user?.id ?? 'se-som',
        team: { id: v.payload.teamId, role: v.payload.role },
        role,
        version: v.payload.version,
        data: v.payload.data,
        screen: 'app',
        tab: 'lag',
        filter: 'all',
        kampTab: 'upcoming',
        openMatch: null,
        openEvent: null,
        sheet: null,
        viewer: null,
        confirm: null,
        draft: null,
        pay: null,
        payCtx: null,
        pcCtx: null,
        pcons: null,
        pushOn: false,
        homeTip: true,
        seenNotifsAt: 0,
        notifyMatch: {},
        links: null,
        coaches: null,
        teams: null,
        toastMsg: null,
        prof: {
          player: { playerId: v.playerId },
          sub: { ...saved.prof.sub, name: v.name || undefined, active: live, cancelled: false, startedAt: null },
          coach: { name: role === 'coach' ? v.name || undefined : undefined },
        },
      });
      window.scrollTo(0, 0);
      setViewing({ v, label, saved });
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      setErr(/pending/.test(msg) ? 'Denne brukeren venter på godkjenning og ser ikke laget ennå.' : 'Fikk ikke åpnet appen som denne brukeren.');
    }
  };

  const stopViewing = () => {
    if (!viewing) return;
    setViewAs(null);
    useStore.setState(viewing.saved, true);
    setViewing(null);
    void load();
  };

  if (state === 'loading') return null;
  if (state === 'nope') return <NotFound />;
  if (state === 'login') return <Login onDone={load} />;
  if (viewing) return <ViewAsHost label={viewing.label} onExit={stopViewing} />;
  if (!data) return null;
  return <Overview data={data} err={err} onViewAs={viewAs} />;
}

/** Looks like the page Next.js shows for an address that doesn't exist. */
function NotFound() {
  return (
    <div className="mod-404">
      <div>
        <h1>404</h1>
        <div>
          <h2>This page could not be found.</h2>
        </div>
      </div>
    </div>
  );
}

function Login({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr('');
    const mail = email.trim().toLowerCase();
    if (!sent && !isEmail(mail)) return setErr('Skriv inn e-postadressen din.');
    setBusy(true);
    try {
      if (!sent) {
        await sendCode(mail);
        setSent(true);
      } else {
        await verifyCode(mail, code.trim());
        onDone();
      }
    } catch {
      setErr(sent ? 'Feil kode. Prøv igjen.' : 'Fikk ikke sendt koden. Prøv igjen om litt.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mod-page" style={{ maxWidth: 420, paddingTop: 64 }}>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <span className="wordmark">InnerCircle</span>
        <h1 className="mod-h1">Logg inn</h1>
        {!sent ? (
          <label className="field">
            <span className="field-label">E-post</span>
            <input className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
        ) : (
          <label className="field">
            <span className="field-label">Koden vi sendte til {email.trim()}</span>
            <input className="input" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} />
          </label>
        )}
        {err && <p className="error">{err}</p>}
        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Et øyeblikk …' : sent ? 'Logg inn' : 'Send kode'}
        </button>
      </form>
    </main>
  );
}

type Part = 'oversikt' | 'lag' | 'brukere' | 'logg';
type OnViewAs = (teamId: string, role: MemberRole, user: ModUser | null, label: string) => void;

function Overview({ data, err, onViewAs }: { data: ModOverview; err: string; onViewAs: OnViewAs }) {
  const [part, setPart] = useState<Part>('oversikt');
  const [pickTeam, setPickTeam] = useState<ModTeam | null>(null);
  const [pickUser, setPickUser] = useState<ModUser | null>(null);
  const users = data.users.filter((u) => !u.moderator);
  const subs = users.filter((u) => u.teams.some((t) => t.role === 'sub' && t.live)).length;
  const waiting = data.teams.reduce((n, t) => n + t.pending, 0);
  const missing = data.teams.reduce((n, t) => n + t.players - t.consentGiven - t.consentDeclined, 0);

  return (
    <main className="mod-page">
      <header className="mod-header">
        <span className="wordmark">InnerCircle</span>
        <span className="mod-badge">Moderator</span>
        <span className="spacer" />
        <span className="note">{data.me}</span>
      </header>
      <Tabs<Part>
        value={part}
        onChange={setPart}
        items={[
          ['oversikt', 'Oversikt'],
          ['lag', 'Lag'],
          ['brukere', 'Brukere'],
          ['logg', 'Logg'],
        ]}
        style={{ marginTop: 12 }}
      />
      {err && <p className="error" style={{ marginTop: 12 }}>{err}</p>}

      {part === 'oversikt' && (
        <>
          <h1 className="mod-h1">Oversikt</h1>
          <p className="note">Bare lesing. Hver gang siden åpnes, og hver gang du ser appen som noen andre, blir det skrevet i loggen.</p>
          <div className="mod-stats">
            <Stat label="Brukere" value={users.length} />
            <Stat label="Lag" value={data.teams.length} />
            <Stat label="Aktive abonnenter" value={subs} />
            <Stat label="Venter på godkjenning" value={waiting} />
            <Stat label="Mangler samtykke" value={missing} />
          </div>
          <div className="mod-grid">
            <Block title="Meldt fra om innlegg">
              {data.reports.length === 0 && <p className="note mod-pad">Ingen meldinger som venter på administratorene.</p>}
              {data.reports.map((r, i) => (
                <div key={i} className="mod-row">
                  <div className="row-text">
                    <span className="row-meta">
                      {r.teamName} · {rel(r.at)}
                    </span>
                    <span className="row-title">{r.question ? 'Spørsmål til administratorene' : r.post ? '«' + r.post + '»' : 'Innlegget er slettet'}</span>
                    {r.text && <span className="row-sub">{r.text}</span>}
                  </div>
                </div>
              ))}
            </Block>
            <Block title="Kan ha stoppet opp">
              <Count label="Fikk kode, men logget aldri inn" n={data.stuck.neverSignedIn} />
              <Count label="Logget inn, men kom aldri inn på et lag" n={data.stuck.noTeam} />
              <Count label="Spillere som har ventet på godkjenning i over 3 dager" n={data.stuck.waitingLong} />
              <Count label="Abonnenter som ikke har betalt eller har gått ut" n={data.stuck.subsNotLive} />
            </Block>
          </div>
        </>
      )}

      {part === 'lag' && (
        <>
          <h1 className="mod-h1">Lag</h1>
          <div className="mod-cards">
            <div className="card mod-card">
              <div className="mod-card-head">
                <span className="row-title">Demolaget · Fjellby IL G14</span>
                {/* A full page load, so the demo's made-up team never mixes with this page's state. */}
                <a href="/demo" className="btn-outline" style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>
                  Åpne demoen
                </a>
              </div>
              <div className="mod-facts">
                <span>Oppdiktet lag uten innlogging, for pitch og visning</span>
                <span>Ingenting blir lagret</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 12 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/demo/qr.png" alt="QR-kode til demoen" width={120} height={120} style={{ borderRadius: 8, background: '#fff' }} />
                <div className="row-text">
                  <span className="note">Skann for å åpne inner-circle-hole-og-audun.vercel.app/demo</span>
                  <a href="/demo/qr.png" download="innercircle-demo-qr.png" className="link-btn start" style={{ padding: 0 }}>
                    Last ned QR-koden
                  </a>
                </div>
              </div>
            </div>
            {data.teams.map((t) => (
              <div key={t.id} className="card mod-card">
                <div className="mod-card-head">
                  <span className="row-title">{t.name}</span>
                  <button type="button" className="btn-outline" onClick={() => setPickTeam(t)}>
                    Se som …
                  </button>
                </div>
                <div className="mod-facts">
                  <span>{t.coaches} administratorer</span>
                  <span>{t.players} spillere</span>
                  <span>{t.subs} abonnenter</span>
                  <span>{t.pending} venter</span>
                  <span>
                    Samtykke {t.consentGiven}/{t.players}
                    {t.consentDeclined ? ` (${t.consentDeclined} sa nei)` : ''}
                  </span>
                  <span>{t.reports ? t.reports + ' meldt fra' : 'Ingen meldt fra'}</span>
                  <span>{t.posts} innlegg</span>
                  <span>{t.lastPost ? 'Siste ' + rel(t.lastPost).toLowerCase() : 'Ingen innlegg ennå'}</span>
                </div>
              </div>
            ))}
            {data.teams.length === 0 && <p className="note">Ingen lag ennå.</p>}
          </div>
        </>
      )}

      {part === 'brukere' && <Users users={users} onPick={setPickUser} onViewAs={onViewAs} />}

      {part === 'logg' && (
        <>
          <h1 className="mod-h1">Logg</h1>
          <p className="note">De siste 50 gangene en moderator har brukt siden.</p>
          <div className="card mod-list">
            {data.log.map((l, i) => (
              <div key={i} className="mod-row">
                <div className="row-text">
                  <span className="row-meta">
                    {rel(new Date(l.at).getTime())} · {l.email}
                  </span>
                  <span>
                    {l.action === 'open'
                      ? 'Åpnet moderatorsiden'
                      : 'Så appen som ' +
                        (l.detail.name || l.detail.email || 'ny ' + (l.detail.role ? ROLES[l.detail.role].toLowerCase() : 'bruker')) +
                        (l.detail.role ? ' (' + ROLES[l.detail.role].toLowerCase() + ', ' + (l.detail.team || '') + ')' : '')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {pickTeam && (
        <Picker title={'Se ' + pickTeam.name + ' som …'} onClose={() => setPickTeam(null)}>
          <p className="h2 mod-pick-head">En rolle</p>
          <p className="note">Slik en ny bruker med rollen ser laget, uten noe eget.</p>
          {(['sub', 'player', 'coach'] as MemberRole[]).map((r) => (
            <PickRow key={r} title={ROLES[r]} onClick={() => onViewAs(pickTeam.id, r, null, 'Ny ' + ROLES[r].toLowerCase() + ' · ' + pickTeam.name)} />
          ))}
          <p className="h2 mod-pick-head">En bestemt bruker</p>
          {users
            .flatMap((u) => u.teams.filter((t) => t.teamId === pickTeam.id).map((t) => ({ u, t })))
            .map(({ u, t }) => (
              <PickRow
                key={u.id + t.role}
                title={u.name || u.email || 'Uten navn'}
                sub={ROLES[t.role] + (t.status === 'pending' ? ' · venter på godkjenning' : !t.live ? ' · ikke aktivt abonnement' : '')}
                disabled={t.status === 'pending'}
                onClick={() => onViewAs(pickTeam.id, t.role, u, label(u, t.role, t.teamName))}
              />
            ))}
        </Picker>
      )}

      {pickUser && (
        <Picker title={'Se som ' + (pickUser.name || pickUser.email || 'brukeren')} onClose={() => setPickUser(null)}>
          {pickUser.teams.map((t) => (
            <PickRow
              key={t.teamId + t.role}
              title={t.teamName}
              sub={ROLES[t.role] + (t.status === 'pending' ? ' · venter på godkjenning' : !t.live ? ' · ikke aktivt abonnement' : '')}
              disabled={t.status === 'pending'}
              onClick={() => onViewAs(t.teamId, t.role, pickUser, label(pickUser, t.role, t.teamName))}
            />
          ))}
        </Picker>
      )}
    </main>
  );
}

const label = (u: ModUser, role: MemberRole, team: string) => (u.name || u.email || 'Bruker') + ' · ' + ROLES[role] + ' · ' + team;

function Users({ users, onPick, onViewAs }: { users: ModUser[]; onPick: (u: ModUser) => void; onViewAs: OnViewAs }) {
  const [q, setQ] = useState('');
  const term = q.trim().toLowerCase();
  const shown = term ? users.filter((u) => (u.name || '').toLowerCase().includes(term) || (u.email || '').toLowerCase().includes(term)) : users;
  const open = (u: ModUser) => {
    const ok = u.teams.filter((t) => t.status === 'active');
    if (u.teams.length === 1 && ok.length === 1) onViewAs(ok[0].teamId, ok[0].role, u, label(u, ok[0].role, ok[0].teamName));
    else onPick(u);
  };
  return (
    <>
      <h1 className="mod-h1">Brukere</h1>
      <label className="field">
        <span className="field-label">Søk</span>
        <input className="input" type="search" placeholder="Navn eller e-post" value={q} onChange={(e) => setQ(e.target.value)} />
      </label>
      <div className="card mod-list" style={{ marginTop: 12 }}>
        {shown.map((u) => (
          <div key={u.id} className="mod-row">
            <div className="row-text">
              <span className="row-title">{u.name || 'Uten navn'}</span>
              <span className="row-sub">
                {u.email} · {u.lastSignIn ? 'innlogget ' + rel(new Date(u.lastSignIn).getTime()).toLowerCase() : u.confirmed ? 'innlogget' : 'aldri logget inn'}
              </span>
              <span className="row-meta">
                {u.teams.length
                  ? u.teams.map((t) => t.teamName + ' · ' + ROLES[t.role].toLowerCase() + (t.status === 'pending' ? ' (venter)' : !t.live ? ' (ikke aktivt)' : '')).join(', ')
                  : 'Ikke på noe lag'}
              </span>
            </div>
            {u.teams.some((t) => t.status === 'active') && (
              <button type="button" className="btn-outline" onClick={() => open(u)}>
                Se som
              </button>
            )}
          </div>
        ))}
        {shown.length === 0 && <p className="note mod-pad">Ingen treff.</p>}
      </div>
      <p className="note" style={{ marginTop: 8 }}>
        E-post vises delvis skjult. Fødselsår, telefonnumre, samtykkeskjemaer og signaturer vises ikke her.
      </p>
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card mod-stat">
      <span className="row-meta">{label}</span>
      <span className="mod-stat-value tnum">{value}</span>
    </div>
  );
}

function Count({ label, n }: { label: string; n: number }) {
  return (
    <div className="mod-row">
      <span className="row-label" style={{ fontSize: 15 }}>
        {label}
      </span>
      <span className="row-value">{n}</span>
    </div>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="section">
      <h2 className="h2">{title}</h2>
      <div className="card mod-list">{children}</div>
    </section>
  );
}

function Picker({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="mod-backdrop" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} className="mod-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="mod-card-head">
          <h2 className="mod-h1" style={{ margin: 0, fontSize: 24 }}>
            {title}
          </h2>
          <button type="button" className="icon-btn" aria-label="Lukk" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function PickRow({ title, sub, disabled, onClick }: { title: string; sub?: string; disabled?: boolean; onClick: () => void }) {
  return (
    <button type="button" className="row-btn" disabled={disabled} onClick={onClick} style={disabled ? { opacity: 0.5, cursor: 'default' } : undefined}>
      <span className="row-text">
        <span className="row-title">{title}</span>
        {sub && <span className="row-sub">{sub}</span>}
      </span>
      {!disabled && <Icon name="chevron_right" className="chev" />}
    </button>
  );
}

/** The app itself, as the chosen account or role sees it, under a banner that says so. Nothing can be saved. */
function ViewAsHost({ label, onExit }: { label: string; onExit: () => void }) {
  const toast = useStore((s) => s.toastMsg);
  return (
    <>
      <div role="status" className="mod-banner">
        <Icon name="visibility" />
        <span className="row-text">
          <span style={{ fontWeight: 700 }}>Ser som {label}</span>
          <span style={{ fontSize: 12, opacity: 0.8 }}>Bare lesing. Ingenting blir lagret.</span>
        </span>
        <button type="button" className="mod-banner-btn" onClick={onExit}>
          Avslutt
        </button>
      </div>
      <AppShell />
      <SheetHost />
      <Viewer />
      {toast && (
        <div key={toast} role="status" className="toast">
          {toast}
        </div>
      )}
    </>
  );
}
