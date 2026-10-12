'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { CKEYS, TYPES } from '@/lib/seed';
import { firstName, fmtDate, fmtShort, initials, inviteLink, nextChargeText, rel, stripe } from '@/lib/format';
import {
  CONSENT_INK,
  CONSENT_LABEL,
  codes,
  coachName,
  consentStatus,
  hasConsent,
  matchTitle,
  playerMap,
  priceText,
  teamName,
  waitsForParent,
} from '@/lib/selectors';
import { pushPrefs, useStore } from '@/lib/store';
import { disablePush, enablePush, isStandalone, needsHomeScreen, phoneKind, updatePushPrefs } from '@/lib/push';
import type { Consent, Player } from '@/lib/types';
import { Icon, SwitchRow } from '../ui';
import { MediaView } from '../MediaView';
import { Rings } from '../screens/RoleScreen';

export const METHOD_NAMES = (last4: string) => ({
  card: 'Kort •••• ' + (last4 || '4242'),
  apple: 'Apple Pay',
  google: 'Google Pay',
  vipps: 'Vipps',
});


function Section({ title, aside, children }: { title: ReactNode; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="section">
      {aside ? (
        <div className="section-head">
          <h2 className="h2">{title}</h2>
          {aside}
        </div>
      ) : (
        <h2 className="h2">{title}</h2>
      )}
      {children}
    </section>
  );
}

function ValueRow({ label, value, ink }: { label: string; value: ReactNode; ink?: string }) {
  return (
    <div className="row">
      <span className="row-label">{label}</span>
      <span className="row-value" style={ink ? { color: ink } : undefined}>
        {value}
      </span>
    </div>
  );
}

function ConsentRows({ consent }: { consent: Consent | null | undefined }) {
  return (
    <div className="list" style={{ marginTop: 4 }}>
      {CKEYS.map(([k, label]) => {
        const on = !!consent?.[k];
        return (
          <div key={k} className="row">
            <span className="row-label">{label}</span>
            <span style={{ font: '600 15px var(--body)', color: on ? 'var(--ok)' : 'var(--muted)' }}>{on ? 'Ja' : 'Nei'}</span>
          </div>
        );
      })}
    </div>
  );
}

function InviteLinkBox({ link }: { link: string }) {
  const copied = useStore((s) => s.copied);
  const copyInvite = useStore((s) => s.copyInvite);
  return (
    <div className="linkbox">
      <span className="linkbox-url">{link.replace(/^https?:\/\//, '')}</span>
      <button type="button" className="link-btn" style={{ padding: '0 8px' }} onClick={() => copyInvite(link)}>
        {copied ? 'Kopiert' : 'Kopier'}
      </button>
    </div>
  );
}

export function MinSide() {
  const st = useStore();
  const { data, role, prof, theme } = st;
  const P = playerMap(data.players);
  const child = role === 'parent' ? P[prof.parent.childId || ''] : undefined;
  const me = role === 'player' ? P[prof.player.playerId || ''] : undefined;
  const via = role === 'sub' ? P[prof.sub.viaId || ''] : undefined;
  const team = teamName(st);

  const name =
    role === 'coach' ? coachName(st) : role === 'player' ? me?.name || 'Spiller' : role === 'parent' ? child?.parent.name || 'Foresatt' : prof.sub.name || 'Abonnent';
  const subtitle =
    role === 'coach'
      ? 'Administrator · ' + team
      : role === 'player'
        ? 'Spiller · ' + team
        : role === 'parent'
          ? 'Foresatt til ' + (child?.name || '')
          : 'Du følger laget via ' + (via ? via.name : 'en spiller');

  return (
    <>
      <header className="app-header">
        <div className="app-title" style={{ flex: 1, minWidth: 0 }}>
          Min side
        </div>
        <button type="button" className="icon-btn round" aria-label="Bytt mellom lys og mørk modus" onClick={st.toggleTheme}>
          <Icon key={theme} name={theme === 'dark' ? 'light_mode' : 'dark_mode'} style={{ animation: 'ic-tick 280ms var(--ease-spring)' }} />
        </button>
      </header>
      <div className="brand-card" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 16 }}>
        <Rings size={180} style={{ top: -60, right: -60 }} />
        <span
          style={{
            position: 'relative',
            width: 56,
            height: 56,
            flex: 'none',
            borderRadius: '50%',
            background: 'var(--gold)',
            color: 'var(--on-gold)',
            display: 'grid',
            placeItems: 'center',
            font: '800 22px var(--display)',
          }}
        >
          {initials(name)}
        </span>
        <div style={{ position: 'relative', minWidth: 0 }}>
          <div style={{ font: 'italic 800 24px/1.05 var(--display)', textTransform: 'uppercase' }}>{name}</div>
          <div style={{ marginTop: 3, font: '500 13px var(--body)', color: 'var(--on-brand-muted)' }}>{subtitle}</div>
        </div>
      </div>

      {role === 'coach' && <CoachSections />}
      {role === 'sub' && <SubSections />}
      {role === 'player' && me && <PlayerSections me={me} />}
      {role === 'parent' && child && <ParentSections child={child} />}

      <TeamsSection />
      <PushSection />
      <HelpSection />

      <div className="list" style={{ marginTop: 28 }}>
        <SwitchRow label="Mørk modus" on={theme === 'dark'} onToggle={st.toggleTheme} />
      </div>
      <button type="button" className="btn btn-secondary btn-block" style={{ marginTop: 24 }} onClick={st.logout}>
        Logg ut
      </button>

      <AccountSection />
    </>
  );
}

/** Privacy policy, terms, leaving the team and deleting the account. */
function AccountSection() {
  const leaveTeam = useStore((s) => s.leaveTeam);
  const deleteAccount = useStore((s) => s.deleteAccount);
  return (
    <Section title="Konto og personvern">
      <div className="list">
        <Link href="/personvern" className="row-btn choice-row" style={{ color: 'inherit', textDecoration: 'none' }}>
          <span className="row-text">
            <span className="row-title">Personvern</span>
          </span>
          <span className="choice-arrow">
            <Icon name="chevron_right" size={20} />
          </span>
        </Link>
        <Link href="/vilkar" className="row-btn choice-row" style={{ color: 'inherit', textDecoration: 'none' }}>
          <span className="row-text">
            <span className="row-title">Vilkår</span>
          </span>
          <span className="choice-arrow">
            <Icon name="chevron_right" size={20} />
          </span>
        </Link>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 8 }}>
        <button type="button" className="link-btn quiet" style={{ padding: 0 }} onClick={leaveTeam}>
          Forlat laget
        </button>
        <button type="button" className="link-btn quiet" style={{ padding: 0, color: 'var(--loss)' }} onClick={deleteAccount}>
          Slett kontoen
        </button>
      </div>
    </Section>
  );
}

function CoachSections() {
  const st = useStore();
  const C = codes(st);
  const players = [...st.data.players].sort((a, b) => (a.num || 0) - (b.num || 0));
  const shown = st.allPlayers ? players : players.slice(0, 8);
  const count = players.length === 1 ? '1 spiller' : players.length + ' spillere';
  const nGiven = players.filter((p) => consentStatus(p) === 'given').length;
  const openConsent = (id: string) => useStore.setState({ sheet: 'consentView', consentPlayer: id });
  const add = (e: FormEvent) => {
    e.preventDefault();
    st.addPlayer();
  };
  const links = st.links || [];
  const waiting = links.filter((l) => l.status === 'pending');
  const P = playerMap(st.data.players);
  const loadLinks = st.loadLinks;
  useEffect(() => {
    void loadLinks();
  }, [loadLinks]);
  const coaches = st.coaches || [];
  const linked = (id: string) => links.filter((l) => l.playerId === id && l.status === 'active');
  const unanswered = players.filter((p) => consentStatus(p) === 'none');
  const reminded = st.data.reminders || {};
  const reports = [...(st.data.reports || [])].sort((a, b) => b.at - a.at);
  const postOf = (id?: string | null) => (id ? st.data.posts.find((x) => x.id === id) : undefined);
  const codeRows = [
    { key: 'coach', label: 'Administratorkode', code: C.coach, hint: 'Kun for administratorer. Andre administratorer logger inn med denne.', copyLabel: 'Administratorkoden' },
    { key: 'team', label: 'Lagkode', code: C.team, hint: 'For spillere, foresatte og abonnenter.', copyLabel: 'Lagkoden' },
  ];
  return (
    <>
      {reports.length > 0 && (
        <Section title="Meldinger" aside={<span className="note">{reports.length}</span>}>
          <p className="note">Fra medlemmer som har meldt fra om et innlegg eller har et spørsmål. Svar på e-post.</p>
          <div className="list">
            {reports.map((r) => {
              const post = postOf(r.postId);
              return (
                <div key={r.id} className="row" style={{ alignItems: 'flex-start', padding: '12px 0', gap: 8 }}>
                  <span className="row-text" style={{ gap: 2 }}>
                    <span style={{ font: '500 16px var(--body)' }}>{r.postId ? 'Meldt fra om et innlegg' : 'Spørsmål'}</span>
                    <span style={{ font: '400 15px/1.4 var(--body)', whiteSpace: 'pre-wrap' }}>{r.text}</span>
                    <span className="row-meta" style={{ wordBreak: 'break-all' }}>
                      {r.name + (r.contact ? ' · ' + r.contact : '') + ' · ' + fmtShort(r.at)}
                    </span>
                    {r.postId && !post && <span className="row-meta">Innlegget er slettet.</span>}
                    {post && (
                      <span style={{ display: 'flex', gap: 16 }}>
                        {post.media.length > 0 && (
                          <button type="button" className="link-btn small start" style={{ minHeight: 0, padding: '4px 0' }} onClick={() => st.openViewer(post.id, 0)}>
                            Vis innlegget
                          </button>
                        )}
                        <button type="button" className="link-btn small start" style={{ minHeight: 0, padding: '4px 0', color: 'var(--accent-ink)' }} onClick={() => st.deletePost(post.id)}>
                          Slett innlegget
                        </button>
                      </span>
                    )}
                  </span>
                  <button type="button" className="link-btn quiet" onClick={() => st.dismissReport(r.id)}>
                    Ferdig
                  </button>
                </div>
              );
            })}
          </div>
        </Section>
      )}
      {waiting.length > 0 && (
        <Section title="Venter på godkjenning" aside={<span className="note">{waiting.length}</span>}>
          <p className="note">Godkjenn bare dem du vet hvem er. Spør hvis du ikke kjenner igjen e-posten.</p>
          <div className="list">
            {waiting.map((l) => {
              const pn = P[l.playerId]?.name || 'Ukjent spiller';
              return (
                <div key={l.userId + l.role} className="row" style={{ alignItems: 'flex-start', padding: '12px 0', gap: 8 }}>
                  <span className="row-text" style={{ gap: 2 }}>
                    <span style={{ font: '500 16px var(--body)' }}>{l.role === 'parent' ? 'Foresatt til ' + pn : pn}</span>
                    <span className="row-meta" style={{ wordBreak: 'break-all' }}>
                      {l.email || 'Ukjent e-post'}
                    </span>
                  </span>
                  <button type="button" className="link-btn quiet" onClick={() => st.decide(l.userId, l.role, false)}>
                    Avvis
                  </button>
                  <button type="button" className="btn btn-primary" style={{ minHeight: 40, padding: '0 14px' }} onClick={() => st.decide(l.userId, l.role, true)}>
                    Godkjenn
                  </button>
                </div>
              );
            })}
          </div>
        </Section>
      )}
      {coaches.length > 0 && (
        <Section title="Administratorer" aside={<span className="note">{coaches.length}</span>}>
          <div className="list">
            {coaches.map((c) => (
              <div key={c.userId} className="row" style={{ alignItems: 'flex-start', padding: '12px 0' }}>
                <span className="row-text" style={{ gap: 2 }}>
                  <span style={{ font: '500 16px var(--body)' }}>
                    {(c.name || 'Navn mangler') + (c.me ? ' (deg)' : '')}
                  </span>
                  <span className="row-meta" style={{ wordBreak: 'break-all' }}>
                    {c.email || 'Ukjent e-post'}
                  </span>
                  <span className="row-meta">
                    {'Administrator siden ' + fmtDate(Date.parse(c.at)) + (c.signedAt ? ' · Har signert administratorreglene' : ' · Har ikke signert administratorreglene')}
                  </span>
                </span>
                {!c.me && (
                  <button type="button" className="link-btn quiet" onClick={() => st.removeCoach(c.userId)}>
                    Fjern
                  </button>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}
      <Section
        title="Laget og kodene"
        aside={
          <button type="button" className="link-btn" onClick={st.openTeamSettings}>
            Endre
          </button>
        }
      >
        <div>
          <div className="row" style={{ padding: '12px 0' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="row-meta">Lagets navn</div>
              <div style={{ marginTop: 2, font: '600 17px var(--body)' }}>{teamName(st)}</div>
            </div>
          </div>
          {codeRows.map((c) => (
            <div key={c.key} className="row" style={{ alignItems: 'flex-start', padding: '12px 0' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="row-meta">{c.label}</div>
                <div style={{ marginTop: 2, font: '600 17px var(--body)', letterSpacing: '.04em' }}>{c.code}</div>
                <div className="row-meta" style={{ marginTop: 2, lineHeight: 1.4 }}>
                  {c.hint}
                </div>
              </div>
              <button type="button" className="link-btn" onClick={() => st.copyCode(c.code, c.copyLabel)}>
                Kopier
              </button>
            </div>
          ))}
        </div>
      </Section>
      <Section title="Spillerne på laget" aside={<span className="note">{count}</span>}>
        <p className="note">
          Alle spillere må godkjenne at det tas bilder av dem før de kan være med i bildestrømmen.
          {players.length > 0 && ` ${nGiven} av ${players.length} har gitt samtykke. Trykk på et navn for å se skjemaet.`}
        </p>
        {unanswered.length > 0 && (
          <div className="card" style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="row-text">
              <span style={{ font: '600 15px var(--body)' }}>
                {unanswered.length === 1 ? '1 har ikke svart' : unanswered.length + ' har ikke svart'}
              </span>
              <span className="row-sub">Spilleren og foresatte får en påminnelse i appen og på mobilen.</span>
            </span>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ minHeight: 40, padding: '0 14px' }}
              onClick={() => st.remindConsent(unanswered.map((p) => p.id))}
            >
              Send påminnelse
            </button>
          </div>
        )}
        <form onSubmit={add} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 8, marginTop: 4 }}>
          <input
            className="input"
            value={st.pf.name}
            onChange={(e) => useStore.setState((s) => ({ pf: { ...s.pf, name: e.target.value, err: '' } }))}
            placeholder="Fornavn og etternavn"
            aria-label="Spillerens navn"
            autoComplete="off"
          />
          <button type="submit" className="btn btn-primary">
            Legg til
          </button>
        </form>
        {st.pf.err && (
          <p role="alert" className="error">
            {st.pf.err}
          </p>
        )}
        {players.length > 0 && (
          <>
            <div className="list" style={{ marginTop: 4 }}>
              {shown.map((p) => (
                <div key={p.id} className="row" style={{ padding: '4px 0', alignItems: 'flex-start' }}>
                  <span className="row-text" style={{ paddingTop: 10 }}>
                    <button
                      type="button"
                      className="link-btn start"
                      style={{ minHeight: 0, padding: 0, font: '400 16px var(--body)', color: 'var(--ink)', textAlign: 'left' }}
                      onClick={() => openConsent(p.id)}
                    >
                      {p.name}
                    </button>
                    <span className="row-meta" style={{ color: CONSENT_INK[consentStatus(p)], fontWeight: 600 }}>
                      {CONSENT_LABEL[consentStatus(p)]}
                      {consentStatus(p) === 'none' && reminded[p.id] ? (
                        <span style={{ fontWeight: 400 }}>{' · påminnet ' + fmtShort(reminded[p.id])}</span>
                      ) : null}
                    </span>
                    {linked(p.id).map((l) => (
                      <span key={l.userId + l.role} className="row-meta" style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {(l.role === 'parent' ? 'Foresatt: ' : 'Spiller: ') + (l.email || 'ukjent e-post')}
                        </span>
                        <button
                          type="button"
                          className="link-btn quiet"
                          style={{ minHeight: 0, padding: 0, fontSize: 13 }}
                          onClick={() => st.decide(l.userId, l.role, false)}
                        >
                          Koble fra
                        </button>
                      </span>
                    ))}
                  </span>
                  <button type="button" className="link-btn quiet" onClick={() => st.openEditPlayer(p.id)}>
                    Endre
                  </button>
                  <button type="button" className="link-btn quiet" onClick={() => st.removePlayer(p.id)}>
                    Fjern
                  </button>
                </div>
              ))}
            </div>
            {players.length > 8 && (
              <button type="button" className="link-btn start" onClick={() => useStore.setState({ allPlayers: !st.allPlayers })}>
                {st.allPlayers ? 'Vis færre' : 'Vis alle ' + players.length}
              </button>
            )}
          </>
        )}
      </Section>
      <Section title="Slett laget">
        <p className="note">
          Laget slettes for alle: spillerlista, kamper, innlegg, bilder og videoer. Alle mister tilgangen. Dette kan ikke angres.
        </p>
        <button
          type="button"
          className="btn btn-secondary"
          style={{ alignSelf: 'flex-start', color: 'var(--accent-ink)' }}
          onClick={() => useStore.setState({ sheet: 'deleteTeam', form: { confirm: '', err: '' } })}
        >
          Slett laget
        </button>
      </Section>
    </>
  );
}

function SubSections() {
  const st = useStore();
  const sub = st.prof.sub;
  const mine = (st.data.payments || []).filter((p) => p.subId === 'sub-' + st.uid);
  const methodText =
    METHOD_NAMES(sub.last4)[sub.method] + (sub.autoRenew === false ? ' · uten automatisk trekk' : ' · automatisk trekk');
  return (
    <>
      <Section title="Abonnement">
        <div>
          <ValueRow label="Status" value={sub.cancelled ? 'Sagt opp' : 'Aktiv'} ink={sub.cancelled ? 'var(--muted)' : 'var(--ok)'} />
          <ValueRow label="Pris" value={priceText(st) + ' / mnd'} />
          <ValueRow
            label={sub.cancelled ? 'Tilgang til' : sub.autoRenew === false ? 'Utløper' : 'Neste trekk'}
            value={nextChargeText(sub.startedAt)}
          />
          <button type="button" className="row-btn" onClick={() => st.openSheet('method')}>
            <span className="row-text">
              <span style={{ font: '400 16px var(--body)' }}>Betalingsmåte</span>
              <span className="row-sub">{methodText}</span>
            </span>
            <Icon name="chevron_right" className="chev" size={20} />
          </button>
          <button type="button" className="row-btn" onClick={() => st.openSheet('receipts')}>
            <span className="row-text">
              <span style={{ font: '400 16px var(--body)' }}>Kvitteringer</span>
              <span className="row-sub">{mine.length === 1 ? '1 kvittering' : mine.length + ' kvitteringer'}</span>
            </span>
            <Icon name="chevron_right" className="chev" size={20} />
          </button>
        </div>
      </Section>
      {sub.cancelled ? (
        <button type="button" className="btn btn-primary btn-block" style={{ marginTop: 20 }} onClick={() => st.openPay('resub')}>
          Start abonnementet igjen
        </button>
      ) : (
        <button type="button" className="link-btn start" style={{ marginTop: 12 }} onClick={st.cancelSub}>
          Si opp abonnement
        </button>
      )}
    </>
  );
}

function followText(n: number) {
  return n === 0 ? 'Ingen følger laget via deg ennå' : n === 1 ? '1 følger laget via deg' : n + ' følger laget via deg';
}

function PlayerSections({ me }: { me: Player }) {
  const st = useStore();
  const c = me.consent;
  const link = inviteLink(codes(st).team, me);
  const nVia = st.data.subs.filter((x) => x.via === me.id).length;
  const text = waitsForParent(me)
    ? 'Du har signert. En foresatt må også si ja fra sin egen telefon: de åpner appen med lagkoden og velger «Jeg er foresatt». Til da er du ikke med på bilder.'
    : c
      ? 'Du har signert samtykket' + (c.adult === false ? ', og en foresatt har også sagt ja' : '') + '. Du kan ombestemme deg når som helst.'
      : me.declined === 'parent'
      ? 'En foresatt har ikke godkjent bilder. Administratorene passer på at du ikke er med på bildene.'
      : 'Du er ikke med på bilder. Administratorene passer på at du ikke er med på bildene.';
  return (
    <>
      <Section title="Samtykke">
        <p className="note">{text}</p>
        <ConsentRows consent={c} />
        <button type="button" className="link-btn start" onClick={st.openPlayerConsent}>
          {c ? 'Endre samtykke' : 'Fyll ut samtykke'}
        </button>
      </Section>
      <Section title="Inviter familien">
        <p className="note" style={{ fontSize: 15 }}>
          Send lenken til besteforeldre og andre som vil heie. De betaler {priceText(st)} i måneden.
        </p>
        <InviteLinkBox link={link} />
        <button type="button" className="btn btn-primary btn-block" onClick={() => st.shareInvite(link)}>
          Del invitasjonslenke
        </button>
        <p className="note">{followText(nVia)}</p>
      </Section>
    </>
  );
}

function ParentSections({ child }: { child: Player }) {
  const st = useStore();
  const { data, theme } = st;
  const kf = firstName(child.name);
  const cc = child.consent;
  const waiting = waitsForParent(child);
  const given = hasConsent(child);
  const nOn = CKEYS.filter(([k]) => cc?.[k]).length;
  const age = child.born ? new Date().getFullYear() - child.born : null;
  const link = inviteLink(codes(st).team, child);
  const posts = data.posts.filter((p) => p.tagged.includes(child.id)).sort((x, y) => y.ts - x.ts);
  const family = data.subs.filter((x) => x.via === child.id);
  const tooYoung = age != null && age < 13;

  return (
    <>
      <Section
        title={'Samtykke for ' + kf}
        aside={
          <span style={{ font: '600 14px var(--body)', color: given ? 'var(--ok)' : 'var(--accent-ink)' }}>
            {waiting ? 'Venter på deg' : !given ? 'Ikke gitt' : nOn === 4 ? 'Gitt' : 'Delvis'}
          </span>
        }
      >
        {waiting && <p className="note">{kf} har signert sin del. Bildene kan brukes når du også har gitt samtykke.</p>}
        <ConsentRows consent={given ? cc : null} />
        {given ? (
          <div className="btn-pair" style={{ marginTop: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={st.editParentConsent}>
              Endre samtykke
            </button>
            <button type="button" className="btn btn-secondary" style={{ color: 'var(--accent-ink)' }} onClick={st.withdrawConsent}>
              Trekk samtykke
            </button>
          </div>
        ) : (
          <button type="button" className="btn btn-primary btn-block" style={{ marginTop: 8 }} onClick={st.editParentConsent}>
            Gi samtykke
          </button>
        )}
      </Section>

      <Section title={'Der ' + kf + ' er med'}>
        {posts.length ? (
          <div className="list">
            {posts.map((p) => {
              const m = p.media[0];
              const mt = p.matchId ? data.matches.find((x) => x.id === p.matchId) : undefined;
              return (
                <div key={p.id} className="row">
                  <span
                    style={{
                      position: 'relative',
                      width: 48,
                      height: 48,
                      flex: 'none',
                      borderRadius: 4,
                      overflow: 'hidden',
                      background: m ? stripe(m.hue ?? 20, theme === 'dark') : 'var(--surface2)',
                    }}
                  >
                    {m?.src && <MediaView src={m.src} kind={m.kind} />}
                  </span>
                  <span className="row-text">
                    <span style={{ font: '500 15px/1.3 var(--body)' }}>
                      {(TYPES[p.type] || TYPES.beskjed).label + (mt ? ' · ' + matchTitle(st, mt) : '')}
                    </span>
                    <span className="row-meta">
                      {rel(p.ts)} · {p.media.length === 1 ? '1 bilde' : p.media.length + ' bilder'}
                    </span>
                  </span>
                  <button type="button" className="link-btn" style={{ fontSize: 14 }} onClick={() => st.removeChildFromPost(p.id)}>
                    Fjern {kf}
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="note">{kf} er ikke merket i noen innlegg.</p>
        )}
      </Section>

      <Section title="Invitasjonslenke">
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={'https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=0&data=' + encodeURIComponent(link)}
            alt="QR-kode for invitasjonslenken"
            width={112}
            height={112}
            style={{ flex: 'none', width: 112, height: 112, padding: 6, background: '#fff', border: '1px solid var(--line)', borderRadius: 4 }}
          />
          <p className="note">Besteforeldre kan skanne koden, eller du kan sende lenken. Bare de med lenken kommer inn.</p>
        </div>
        <InviteLinkBox link={link} />
        <button type="button" className="btn btn-secondary" onClick={() => st.shareInvite(link)}>
          Del lenken
        </button>
      </Section>

      <Section title="Familiens krets">
        {family.length ? (
          <div className="list">
            {family.map((x) => (
              <div key={x.id} className="row">
                <span className="row-text">
                  <span style={{ font: '500 16px var(--body)' }}>{x.name}</span>
                  <span className="row-meta">
                    {(x.rel ? x.rel + ' · ' : '') + 'siden ' + fmtShort(x.since)}
                  </span>
                </span>
                <button type="button" className="link-btn quiet" onClick={() => st.removeSub(x.id)}>
                  Fjern
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="note">Ingen abonnerer via {kf} ennå. Del lenken over.</p>
        )}
      </Section>

      <div style={{ marginTop: 16 }}>
        <SwitchRow
          label={kf + ' logger inn selv'}
          sub={tooYoung ? 'Kan slås på fra 13 år' : 'Får egen innlogging og ser bildene der ' + kf + ' er med'}
          on={child.selfLogin}
          disabled={tooYoung}
          onToggle={() => st.updPlayer(child.id, { selfLogin: !child.selfLogin })}
        />
      </div>

      {!st.prof.parent.subscribed && (
        <Section title="Følg hele laget">
          <p className="note" style={{ fontSize: 15 }}>
            Se alle innlegg fra {teamName(st)}, ikke bare der {kf} er med. {priceText(st)} i måneden.
          </p>
          <button type="button" className="btn btn-primary" style={{ alignSelf: 'flex-start', marginTop: 4 }} onClick={() => st.openPay('parent')}>
            Abonner
          </button>
        </Section>
      )}
    </>
  );
}

const PUSH_MSG: Record<string, string> = {
  denied: 'Varsler er blokkert. Slå dem på for denne siden i innstillingene til nettleseren.',
  unsupported: 'Denne nettleseren støtter ikke varsler.',
  error: 'Fikk ikke slått på varsler. Prøv igjen.',
};

/** Push notifications on this phone, and which kinds to get. */
function PushSection() {
  const st = useStore();
  const [busy, setBusy] = useState(false);
  const team = st.team;
  const on = !!st.pushOn;
  const nf = st.prof.sub.notify || { posts: true, matches: true, results: true };
  const homeScreen = needsHomeScreen();
  const guide = !!phoneKind() && !isStandalone();
  if (!team) return null;

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    if (on) {
      await disablePush();
      useStore.setState({ pushOn: false });
      st.toast('Varsler er slått av på denne enheten');
    } else {
      const res = await enablePush(team.id, pushPrefs(st));
      if (res === 'ok') {
        useStore.setState({ pushOn: true });
        st.toast('Varsler er slått på');
      } else if (res !== 'homescreen') st.toast(PUSH_MSG[res]);
    }
    setBusy(false);
  };
  const setPref = (k: keyof typeof nf) => () => {
    const next = { ...nf, [k]: !nf[k] };
    st.setProf('sub', { notify: next });
    void updatePushPrefs(team.id, { ...pushPrefs(st), ...next });
  };

  return (
    <Section title="Varsler">
      {homeScreen ? (
        <p className="note">På iPhone må appen ligge på Hjem-skjermen for å få varsler. Legg den til, og åpne appen derfra.</p>
      ) : (
        <div>
          <SwitchRow label="Varsler på denne mobilen" sub="Du får beskjed når administratoren legger ut noe" on={on} onToggle={toggle} disabled={busy} />
          {on && (
            <>
              <SwitchRow label="Nye innlegg" sub="Bilder, video og beskjeder" on={nf.posts} onToggle={setPref('posts')} />
              <SwitchRow label="Kamper og treninger" sub="Når en kamp eller trening blir lagt inn, endret eller avlyst" on={nf.matches} onToggle={setPref('matches')} />
              <SwitchRow label="Resultater" sub="Når et resultat er lagt inn" on={nf.results} onToggle={setPref('results')} />
            </>
          )}
        </div>
      )}
      {guide && (
        <button type="button" className="btn btn-secondary btn-block" style={{ marginTop: 12 }} onClick={() => st.openSheet('homeScreen')}>
          Slik legger du appen på Hjem-skjermen
        </button>
      )}
    </Section>
  );
}

/** Answers to common questions, and a way to ask the coaches. */
function HelpSection() {
  const st = useStore();
  return (
    <Section title="Hjelp">
      <div>
        <button type="button" className="row-btn" onClick={() => st.openSheet('help')}>
          <span className="row-text">
            <span style={{ font: '400 16px var(--body)' }}>Vanlige spørsmål</span>
            <span className="row-sub">Varsler, samtykke, abonnement og hvem som ser bildene</span>
          </span>
          <Icon name="chevron_right" className="chev" size={20} />
        </button>
        {st.role !== 'coach' && (
          <button type="button" className="row-btn" onClick={() => st.openReport(null)}>
            <span className="row-text">
              <span style={{ font: '400 16px var(--body)' }}>Spør administratorene</span>
              <span className="row-sub">De svarer på e-posten du logget inn med</span>
            </span>
            <Icon name="chevron_right" className="chev" size={20} />
          </button>
        )}
      </div>
    </Section>
  );
}

const ROLE_NAME: Record<string, string> = { coach: 'Administrator', player: 'Spiller', parent: 'Foresatt', sub: 'Abonnent' };

/** Other teams and roles this account has. Shown only when there is somewhere else to go. */
function TeamsSection() {
  const st = useStore();
  const loadTeams = st.loadTeams;
  useEffect(() => {
    void loadTeams();
  }, [loadTeams]);
  const teams = st.teams || [];
  const isCurrent = (t: { teamId: string; role: string }) => t.teamId === st.team?.id && t.role === st.team?.role;
  if (!teams.some((t) => !isCurrent(t))) return null;
  return (
    <Section title="Dine lag">
      <p className="note">Bytt til et annet lag eller en annen rolle uten å logge ut.</p>
      <div>
        {teams.map((t) => {
          const current = isCurrent(t);
          const waiting = t.status === 'pending';
          return (
            <button
              key={t.teamId + t.role}
              type="button"
              className="row-btn"
              disabled={current}
              onClick={() => st.switchTeam(t.teamId, t.role)}
            >
              <span className="row-text">
                <span style={{ font: '400 16px var(--body)' }}>{t.teamName}</span>
                <span className="row-sub">
                  {ROLE_NAME[t.role] + (current ? ' · vises nå' : waiting ? ' · venter på godkjenning' : '')}
                </span>
              </span>
              {!current && <Icon name="chevron_right" className="chev" size={20} />}
            </button>
          );
        })}
      </div>
    </Section>
  );
}
