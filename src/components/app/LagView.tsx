'use client';

import { homeAway, splitMatches, visiblePosts } from '@/lib/derive';
import { inviteLink, nextChargeText } from '@/lib/format';
import { canPost, codes, hasConsent, matchTitle, missingParent, opponentText, playerMap, priceText, seesTeamInfo, teamName } from '@/lib/selectors';
import { useStore } from '@/lib/store';
import type { AppState, Player, Post } from '@/lib/types';
import { Chips, DateCol, Icon } from '../ui';
import { PostCard } from './PostCard';

const FILTERS: [AppState['filter'], string][] = [
  ['all', 'Alle'],
  ['kamp', 'Kamp'],
  ['trening', 'Trening'],
  ['beskjed', 'Beskjed'],
];

export function Feed({ posts, P, emptyText }: { posts: Post[]; P: Record<string, Player>; emptyText: string }) {
  const sorted = [...posts].sort((a, b) => b.ts - a.ts);
  return (
    <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 14 }}>
      {sorted.map((p) => (
        <PostCard key={p.id} post={p} P={P} />
      ))}
      {sorted.length === 0 && (
        <p className="note" style={{ padding: '40px 0', textAlign: 'center' }}>
          {emptyText}
        </p>
      )}
    </div>
  );
}

export function LagView() {
  const st = useStore();
  const { data, role, prof, filter } = st;
  const P = playerMap(data.players);
  const isCoach = role === 'coach';
  const me = role === 'player' ? P[prof.player.playerId || ''] : undefined;
  const unread = data.notifs.filter((n) => n.ts > st.seenNotifsAt && !(isCoach && n.from === 'coach') && !(n.team && !seesTeamInfo(role))).length;
  const { next } = splitMatches(data.matches);
  const price = priceText(st);
  const waiting = isCoach ? (st.links || []).filter((l) => l.status === 'pending').length : 0;
  const nReports = isCoach ? (data.reports || []).length : 0;
  // A coach asked this player to answer the consent form (or to have a parent sign it too).
  const reminded = !!me && !!data.reminders?.[me.id] && !hasConsent(me) && !me.declined;

  let list = visiblePosts(st, data.posts, P);
  if (filter !== 'all') list = list.filter((p) => p.type === filter);

  const nVia = me ? data.subs.filter((x) => x.via === me.id).length : 0;
  const followText = nVia === 0 ? 'Ingen følger laget via deg ennå' : nVia === 1 ? '1 følger laget via deg' : nVia + ' følger laget via deg';

  return (
    <>
      <header className="app-header">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="app-title" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {teamName(st)}
          </div>
          <div className="app-subtitle">
            <Icon name="lock" size={13} style={{ color: 'var(--gold)' }} />
            Lukket strøm · kun for inviterte
          </div>
        </div>
        <button
          type="button"
          className="icon-btn round"
          aria-label={unread > 0 ? `Varsler, ${unread} nye` : 'Varsler'}
          style={{ position: 'relative' }}
          onClick={() => st.openSheet('notifs')}
        >
          <Icon name="notifications" size={22} />
          {unread > 0 && (
            <span
              key={unread}
              style={{
                position: 'absolute',
                top: -3,
                right: -3,
                minWidth: 18,
                height: 18,
                padding: '0 5px',
                borderRadius: 9,
                background: 'var(--gold)',
                color: 'var(--on-gold)',
                font: '700 11px/18px var(--body)',
                textAlign: 'center',
                animation: 'ic-pop 380ms var(--ease-out)',
              }}
            >
              {unread}
            </span>
          )}
        </button>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {isCoach && waiting > 0 && (
          <button type="button" className="card card-btn" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', color: 'var(--ink)', textAlign: 'left', cursor: 'pointer' }} onClick={() => st.setTab('min')}>
            <span className="row-text">
              <span style={{ font: '600 16px var(--body)', color: 'var(--accent-ink)' }}>
                {waiting === 1 ? '1 venter på godkjenning' : waiting + ' venter på godkjenning'}
              </span>
              <span className="row-sub">Spillere som vil inn på laget.</span>
            </span>
            <Icon name="arrow_forward" size={20} style={{ color: 'var(--accent-ink)' }} />
          </button>
        )}

        {nReports > 0 && (
          <button type="button" className="card card-btn" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', color: 'var(--ink)', textAlign: 'left', cursor: 'pointer' }} onClick={() => st.setTab('min')}>
            <span className="row-text">
              <span style={{ font: '600 16px var(--body)', color: 'var(--accent-ink)' }}>
                {nReports === 1 ? '1 melding' : nReports + ' meldinger'}
              </span>
              <span className="row-sub">Noen har meldt fra om et innlegg eller har et spørsmål.</span>
            </span>
            <Icon name="arrow_forward" size={20} style={{ color: 'var(--accent-ink)' }} />
          </button>
        )}

        {reminded && (
          <button
            type="button"
            className="card card-btn"
            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', color: 'var(--ink)', textAlign: 'left', cursor: 'pointer' }}
            onClick={st.openPlayerConsent}
          >
            <span className="row-text">
              <span style={{ font: '600 16px var(--body)', color: 'var(--accent-ink)' }}>Svar på samtykket</span>
              <span className="row-sub">
                {missingParent(me)
                  ? 'Du er under 15, så en foresatt må også signere. Fyll ut samtykket sammen med en foresatt.'
                  : 'Administratoren minner deg om å svare på om du vil være med på bilder.'}
              </span>
            </span>
            <Icon name="arrow_forward" size={20} style={{ color: 'var(--accent-ink)' }} />
          </button>
        )}

        {isCoach && data.players.length === 0 && (
          <button type="button" className="card card-btn" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', color: 'var(--ink)', textAlign: 'left', cursor: 'pointer' }} onClick={() => st.setTab('min')}>
            <span className="row-text">
              <span style={{ font: '600 16px var(--body)', color: 'var(--accent-ink)' }}>Legg inn spillerne</span>
              <span className="row-sub">Skriv inn alle på laget under Min side.</span>
            </span>
            <Icon name="arrow_forward" size={20} style={{ color: 'var(--accent-ink)' }} />
          </button>
        )}

        {next && (
          <button
            type="button"
            onClick={st.goKamper}
            className="brand-card card-btn"
            style={{ display: 'flex', alignItems: 'stretch', padding: 0, textAlign: 'left', cursor: 'pointer' }}
          >
            <DateCol date={next.date} block />
            <span className="row-text" style={{ padding: '14px', gap: 3 }}>
              <span className="eyebrow" style={{ color: 'var(--brand-accent)' }}>
                Neste kamp · {homeAway(next)}
              </span>
              <span style={{ font: 'italic 800 22px/1.05 var(--display)', textTransform: 'uppercase' }}>{matchTitle(st, next)}</span>
              {opponentText(next) && <span style={{ font: '500 14px var(--body)' }}>{opponentText(next)}</span>}
              <span style={{ font: '400 13px var(--body)', color: 'var(--on-brand-muted)' }}>
                {next.time} · {next.venue}
              </span>
            </span>
            <span style={{ display: 'grid', placeItems: 'center', paddingRight: 12, color: 'var(--brand-accent)' }}>
              <Icon name="chevron_right" />
            </span>
          </button>
        )}

        {role === 'sub' && (
          <p className="note">
            {prof.sub.cancelled
              ? `Abonnementet er sagt opp. Du ser bildene til ${nextChargeText(prof.sub.startedAt)}.`
              : `Du støtter laget med ${price} i måneden. Takk for at du heier!`}
          </p>
        )}

        {role === 'player' && (
          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 12px 12px 16px' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ font: '600 15px var(--body)' }}>Inviter familien</div>
              <div className="note" style={{ fontSize: 13 }}>
                {followText}
              </div>
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => me && st.shareInvite(inviteLink(codes(st).team, me))}
            >
              Del lenke
            </button>
          </div>
        )}

        {canPost(st) && (isCoach || data.matches.length > 0) && (
          <button
            type="button"
            className="card-btn"
            onClick={() => st.openComposer(null)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              minHeight: 54,
              padding: '0 8px 0 16px',
              border: '1px dashed var(--line-strong)',
              borderRadius: 16,
              background: 'var(--field)',
              color: 'var(--muted)',
              font: '400 15px var(--body)',
              textAlign: 'left',
              cursor: 'pointer',
            }}
          >
            <span style={{ flex: 1 }}>{isCoach ? 'Del noe med laget …' : 'Del bilder fra en kamp …'}</span>
            <span style={{ width: 38, height: 38, borderRadius: 12, background: 'var(--accent)', color: 'var(--on-accent)', display: 'grid', placeItems: 'center' }}>
              <Icon name="add_photo_alternate" size={22} />
            </span>
          </button>
        )}

        <Chips label="Filter" value={filter} items={FILTERS} onChange={st.setFilter} />
      </div>

      <Feed key={filter} posts={list} P={P} emptyText="Ingen innlegg her ennå." />
    </>
  );
}
