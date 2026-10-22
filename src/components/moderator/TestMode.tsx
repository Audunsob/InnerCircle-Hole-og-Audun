'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { ROLES, LS_KEY, freshState } from '@/lib/seed';
import { resetSandbox, sandboxDb, sandboxRpc, sandboxSession, setSandboxSession, type SbMember, type SbUser } from '@/lib/sandbox';
import { useStore, type Store } from '@/lib/store';
import type { TeamPayload } from '@/lib/supabase';
import type { PersistedState } from '@/lib/types';
import { switchTestMode } from '@/lib/testmode';
import InnerCircleApp from '../InnerCircleApp';
import { Icon } from '../ui';

/**
 * The «Test» tab on the moderator page (/moderator?test): the whole app, with every screen and role,
 * against a made-up database in this browser. Log in as anyone on the made-up team, or start as a new user
 * and go through sign-up, create teams, post and delete teams. Codes are filled in for you. Nothing reaches
 * the real database, no emails are sent and no phones are notified. ModeratorApp checks who may see it.
 */
export default function TestMode({ nav }: { nav: ReactNode }) {
  useEffect(() => {
    document.title = 'InnerCircle · Testmodus';
  }, []);

  return (
    <>
      <div className="mod-nav">{nav}</div>
      <TestBar />
      <InnerCircleApp />
    </>
  );
}

/** Opens the app on this device as `next`, from a fresh start, like a phone that was just set up. */
function restart(next: Partial<PersistedState>) {
  const theme = useStore.getState().theme;
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ ...freshState(), theme, homeTip: true, ...next }));
  } catch {}
  window.scrollTo(0, 0);
  window.location.reload();
}

/** Straight into a team in one role, as the account would be after logging in. */
function enterAs(u: SbUser, m: SbMember) {
  setSandboxSession(u.id);
  const p = sandboxRpc('get_team', { p_team: m.teamId, p_role: m.role }) as TeamPayload;
  const prof = freshState().prof;
  if (m.role === 'player') prof.player = { playerId: m.playerId };
  if (m.role === 'coach')
    prof.coach = { name: (p.data.coachConsents || []).filter((c) => c.contact === u.email).pop()?.name || u.name || undefined };
  if (m.role === 'sub') {
    const own = p.data.subs.find((x) => x.id === 'sub-' + u.id);
    if (own) prof.sub = { ...prof.sub, viaId: own.via, name: own.name, active: true, startedAt: own.since, autoRenew: own.autoRenew !== false };
  }
  restart({ uid: u.id, team: { id: m.teamId, role: m.role }, role: m.role, version: p.version, data: p.data, screen: 'app', onboarded: { [m.role]: true }, prof });
}

/** At the start screen, signed in as this account (or nobody), to go through the sign-up. */
function enterAtStart(u: SbUser | null) {
  setSandboxSession(u?.id ?? null);
  const fresh = freshState();
  restart({ uid: u?.id ?? fresh.uid, flow: { ...fresh.flow, contact: u?.email ?? '' } });
}

/** A new, unused test email. */
function newEmail() {
  const used = new Set(sandboxDb().users.map((u) => u.email));
  let n = 1;
  while (used.has('ny' + n + '@test.innercircle.no')) n++;
  return 'ny' + n + '@test.innercircle.no';
}

/** Fills in the codes and other typing the screen on show asks for, so the whole sign-up can be clicked through. */
function prefill(st: Store) {
  const db = sandboxDb();
  const byNewest = [...db.teams].sort((a, b) => b.at - a.at);
  const newest = byNewest[0];
  // Players pick themselves from the list, and subscribers pick who invited them: a team without players won't do.
  const joinable = byNewest.find((t) => t.data.players.length) || newest;
  const f = st.flow;
  const name = 'Test Testesen';
  switch (st.screen) {
    case 'login':
      if (!f.contact) st.setFlow({ contact: newEmail() });
      break;
    case 'otp':
      if (!f.otp) st.setFlow({ otp: '123456' });
      break;
    case 'teamCode':
      if (!f.teamCode && joinable) st.setFlow({ teamCode: joinable.teamCode });
      break;
    case 'invite':
      if (!f.invite && joinable) st.setFlow({ invite: joinable.teamCode });
      break;
    case 'terms':
      if (!f.subName) st.setFlow({ subName: 'Test Abonnent' });
      if (!f.inviteVia && f.peek?.players[0]) st.setFlow({ inviteVia: f.peek.players[0].id });
      break;
    case 'coachCode': {
      const known = f.coachTeams?.length ? db.teams.find((t) => t.id === f.coachTeams![0].id) : null;
      const team = known || newest;
      if (!f.coachCode && team) st.setFlow({ coachCode: team.coachCode });
      if (!known && !f.coachName) st.setFlow({ coachName: name });
      break;
    }
    case 'createTeam':
      if (!f.coachName) st.setFlow({ coachName: name });
      if (!f.teamName) st.setFlow({ teamName: 'Testlag ' + (db.teams.length + 1) });
      if (!f.newCoachCode || !f.newTeamCode) useStore.getState().suggestCodes();
      break;
  }
  if (st.pay && !st.pay.num) st.setPay({ num: '4242 4242 4242 4242', exp: '12/' + String((new Date().getFullYear() + 3) % 100), cvc: '123' });
  const form = st.form as Record<string, unknown>;
  if (st.sheet === 'switchTeam' && !form.code) {
    const t = db.teams.find((x) => x.id === form.teamId);
    if (t) st.setForm({ code: t.coachCode });
  }
  if (st.sheet === 'deleteTeam' && !form.confirm && st.data.teamName) st.setForm({ confirm: st.data.teamName });
}

/** The banner on top: who you are in the test, and the panel to switch. */
function TestBar() {
  const [open, setOpen] = useState(false);
  const role = useStore((s) => s.role);
  const team = useStore((s) => s.data.teamName);
  const screen = useStore((s) => s.screen);
  const me = sandboxSession();

  useEffect(() => {
    prefill(useStore.getState());
    return useStore.subscribe((st, prev) => {
      if (st.screen !== prev.screen || st.sheet !== prev.sheet || !!st.pay !== !!prev.pay) prefill(st);
    });
  }, []);

  const who = screen === 'app' && role ? ROLES[role] + (team ? ' · ' + team : '') : me ? 'Logget inn, ikke på et lag' : 'Ikke logget inn';

  return (
    <>
      <div role="status" className="mod-banner">
        <Icon name="science" />
        <span className="row-text">
          <span style={{ fontWeight: 700 }}>Testmodus{me ? ' · ' + (me.name || me.email) : ''}</span>
          <span style={{ fontSize: 12, opacity: 0.8 }}>{who}. Alt er oppdiktet, og ingenting når ekte lag.</span>
        </span>
        <button type="button" className="mod-banner-btn" onClick={() => setOpen(true)}>
          Bytt
        </button>
      </div>
      {open && <Panel onClose={() => setOpen(false)} />}
    </>
  );
}

function Panel({ onClose }: { onClose: () => void }) {
  const db = sandboxDb();
  const teamName = (id: string) => db.teams.find((t) => t.id === id)?.name || 'Slettet lag';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const reset = () => {
    if (!window.confirm('Slette alt du har gjort i testmodus og starte med testlaget på nytt?')) return;
    resetSandbox();
    restart({});
  };

  return (
    <div className="mod-backdrop test-panel" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Testmodus" className="mod-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="mod-card-head">
          <h2 className="mod-h1" style={{ margin: 0, fontSize: 24 }}>
            Testmodus
          </h2>
          <button type="button" className="icon-btn" aria-label="Lukk" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        <p className="note">
          Appen kjører mot en oppdiktet database i denne nettleseren. Ingen e-post sendes, ingen telefoner varsles, og koder fylles inn for deg.
        </p>

        <p className="h2 mod-pick-head">Logg inn som</p>
        {db.users.map((u) => {
          const ms = db.members.filter((m) => m.userId === u.id && db.teams.some((t) => t.id === m.teamId));
          const active = ms.filter((m) => m.status === 'active');
          const waiting = ms.filter((m) => m.status === 'pending');
          return (
            <div key={u.id}>
              {active.map((m) => (
                <PickRow
                  key={m.teamId + m.role}
                  title={(u.name || u.email) + ' · ' + ROLES[m.role]}
                  sub={teamName(m.teamId) + ' · ' + u.email}
                  onClick={() => enterAs(u, m)}
                />
              ))}
              {!active.length && (
                <PickRow
                  title={u.name || u.email}
                  sub={(waiting.length ? 'Venter på godkjenning på ' + waiting.map((m) => teamName(m.teamId)).join(', ') : 'Ikke på noe lag') + ' · ' + u.email}
                  onClick={() => enterAtStart(u)}
                />
              )}
            </div>
          );
        })}
        <PickRow title="Ny bruker" sub="Start helt fra begynnelsen: velg rolle, logg inn, bli med på eller opprett et lag" onClick={() => enterAtStart(null)} />

        <p className="h2 mod-pick-head">Lag i testmodus</p>
        {db.teams.map((t) => (
          <div key={t.id} className="mod-row">
            <div className="row-text">
              <span className="row-title">{t.name}</span>
              <span className="row-sub">
                Lagkode {t.teamCode} · Administratorkode {t.coachCode}
              </span>
            </div>
          </div>
        ))}
        {db.teams.length === 0 && <p className="note">Ingen lag. Opprett ett som ny bruker, eller start på nytt.</p>}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
          <button type="button" className="btn-outline" onClick={reset}>
            Start testen på nytt
          </button>
          <button type="button" className="btn-outline" onClick={() => switchTestMode(false)}>
            Til oversikten
          </button>
        </div>
      </div>
    </div>
  );
}

function PickRow({ title, sub, onClick }: { title: string; sub?: string; onClick: () => void }) {
  return (
    <button type="button" className="row-btn" onClick={onClick}>
      <span className="row-text">
        <span className="row-title">{title}</span>
        {sub && <span className="row-sub">{sub}</span>}
      </span>
      <Icon name="chevron_right" className="chev" />
    </button>
  );
}
