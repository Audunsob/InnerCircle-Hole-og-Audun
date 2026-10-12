'use client';

import { useEffect, useRef, useState } from 'react';
import { OUTCOME_COLOR, outcomeOf, scoreTitle } from '@/lib/derive';
import { firstName, initials, rel, stripe } from '@/lib/format';
import { TYPES } from '@/lib/seed';
import { useStore } from '@/lib/store';
import type { Player, Post } from '@/lib/types';
import { Icon } from '../ui';
import { MediaView } from '../MediaView';

export function PostCard({ post, P }: { post: Post; P: Record<string, Player> }) {
  const role = useStore((s) => s.role);
  const uid = useStore((s) => s.uid);
  const dark = useStore((s) => s.theme === 'dark');
  const match = useStore((s) => (post.matchId ? s.data.matches.find((m) => m.id === post.matchId) : undefined));
  const resultTitle = useStore((s) => (match && post.type === 'kamp' && outcomeOf(match) ? scoreTitle(s, match) : ''));
  const toggleLike = useStore((s) => s.toggleLike);
  const openViewer = useStore((s) => s.openViewer);
  const openReport = useStore((s) => s.openReport);
  const [pop, setPop] = useState(false);
  const popTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(popTimer.current), []);

  const outcome = resultTitle && match ? outcomeOf(match) : null;
  const liked = post.likedBy.includes(uid);
  const canEdit = role === 'coach' && post.authorId === 'coach';

  const tagged = post.tagged.map((id) => P[id]).filter(Boolean);
  const shown = tagged.filter((x) => x.consent?.name).map((x) => firstName(x.name));
  const hidden = tagged.length - shown.length;
  const tagText = tagged.length
    ? 'Med: ' + shown.join(', ') + (hidden ? (shown.length ? ' + ' : '') + hidden + (hidden === 1 ? ' spiller' : ' spillere') : '')
    : '';

  const typeLabel = (TYPES[post.type] || TYPES.beskjed).label + (match && post.type === 'kamp' && match.opp ? ' mot ' + match.opp : '');
  const many = post.media.length > 1;

  const like = () => {
    toggleLike(post.id);
    // Only giving a heart celebrates; taking it back is quiet.
    setPop(false);
    clearTimeout(popTimer.current);
    if (liked) return;
    requestAnimationFrame(() => setPop(true));
    popTimer.current = setTimeout(() => setPop(false), 450);
  };

  return (
    <article className="card" style={{ overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px' }}>
        <span
          style={{
            width: 38,
            height: 38,
            flex: 'none',
            borderRadius: '50%',
            border: '1.5px solid var(--gold)',
            background: 'var(--surface2)',
            color: 'var(--accent-ink)',
            display: 'grid',
            placeItems: 'center',
            font: '700 14px var(--body)',
          }}
        >
          {initials(post.author)}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ font: '600 15px/1.3 var(--body)' }}>
            {post.author} <span style={{ fontWeight: 400, color: 'var(--muted)' }}>{post.authorRole === 'Trener' ? 'Administrator' : post.authorRole}</span>
          </div>
          <div style={{ font: '400 13px/1.3 var(--body)', color: 'var(--muted)' }}>
            {typeLabel} · {rel(post.ts)}
          </div>
        </div>
        {canEdit && (
          <button
            type="button"
            className="icon-btn"
            aria-label="Valg for innlegget"
            style={{ marginRight: -8, color: 'var(--muted)' }}
            onClick={() => useStore.setState({ sheet: 'postMenu', menuPost: post.id })}
          >
            <Icon name="more_horiz" />
          </button>
        )}
      </div>

      {outcome && (
        <div className="tnum" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px 12px', font: 'italic 800 20px/1.1 var(--display)', textTransform: 'uppercase' }}>
          <span className="outcome" style={{ background: OUTCOME_COLOR[outcome], fontStyle: 'normal' }}>
            {outcome}
          </span>
          <span>{resultTitle}</span>
        </div>
      )}

      {post.media.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: 2,
            overflowX: 'auto',
            scrollSnapType: 'x mandatory',
            margin: 0,
            scrollbarWidth: 'none',
          }}
        >
          {post.media.map((m, i) => (
            <button
              key={m.id || i}
              type="button"
              onClick={() => openViewer(post.id, i)}
              aria-label={`Åpne ${m.label || 'bilde'} i fullskjerm`}
              className="no-press"
              style={{
                position: 'relative',
                flex: '0 0 ' + (many ? '84%' : '100%'),
                aspectRatio: '4/5',
                border: 'none',
                padding: 0,
                scrollSnapAlign: 'start',
                cursor: 'zoom-in',
                background: stripe(m.hue ?? 20, dark),
                overflow: 'hidden',
              }}
            >
              {m.src ? (
                <MediaView src={m.src} kind={m.kind} />
              ) : (
                <span className="media-label">{m.label || 'bilde'}</span>
              )}
              {m.kind === 'video' && (
                <>
                  <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
                    <span
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: '50%',
                        background: 'rgba(0,0,0,.55)',
                        color: '#fff',
                        display: 'grid',
                        placeItems: 'center',
                      }}
                    >
                      <Icon name="play_arrow" size={34} filled />
                    </span>
                  </span>
                  <span className="badge-dark" style={{ right: 8, bottom: 8 }}>
                    {m.dur}
                  </span>
                </>
              )}
              {many && (
                <span className="badge-dark" style={{ top: 8, right: 8 }}>
                  {i + 1}/{post.media.length}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {post.text && <p style={{ margin: 0, padding: '12px 14px 0', font: '400 15px/1.5 var(--body)', textWrap: 'pretty' }}>{post.text}</p>}
      {tagText && (
        <p className="note" style={{ padding: '6px 14px 0', fontSize: 13 }}>
          {tagText}
        </p>
      )}

      <div style={{ display: 'flex', alignItems: 'center', padding: '2px 14px 4px' }}>
        <button
          type="button"
          onClick={like}
          aria-pressed={liked}
          aria-label={liked ? 'Fjern hjerte' : 'Gi hjerte'}
          className="tnum"
          style={{
            minHeight: 48,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginLeft: -10,
            padding: '0 10px',
            border: 'none',
            background: 'none',
            color: liked ? 'var(--heart)' : 'var(--muted)',
            font: '600 15px var(--body)',
            cursor: 'pointer',
          }}
        >
          <span className={'heart' + (pop ? ' pop' : '')}>
            <Icon name="favorite" size={26} filled={liked} />
          </span>
          <span key={post.likes + post.likedBy.length} style={{ display: 'inline-block', animation: 'ic-rise 200ms var(--ease-out)' }}>
            {post.likes + post.likedBy.length}
          </span>
        </button>
        {post.edited && <span style={{ marginLeft: 'auto', font: '400 13px var(--body)', color: 'var(--muted)' }}>Redigert</span>}
        {role !== 'coach' && (
          <button
            type="button"
            className="icon-btn"
            aria-label="Meld fra om innlegget"
            title="Meld fra"
            style={{ marginLeft: post.edited ? 4 : 'auto', marginRight: -10, color: 'var(--muted)' }}
            onClick={() => openReport(post.id)}
          >
            <Icon name="flag" size={20} />
          </button>
        )}
      </div>
    </article>
  );
}
