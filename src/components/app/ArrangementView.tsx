'use client';

import { eventHours, splitEvents, visiblePosts } from '@/lib/derive';
import { fmtLong } from '@/lib/format';
import { canPost, playerMap } from '@/lib/selectors';
import { useStore } from '@/lib/store';
import { allEvents, findEvent, isRunning, isTraining, repeatText, timeText, type TrainingEvent } from '@/lib/trainings';
import type { TeamEvent } from '@/lib/types';
import { DateCol, Icon } from '../ui';
import { Feed, PostPrompt } from './LagView';


/**
 * Pizza nights, meetings, trainings: everything on the calendar that isn't a match, under the matches in Program.
 * Subscribers see only those someone has posted from, and never the fixed trainings.
 */
export function EventsSection({ view }: { view: 'upcoming' | 'past' }) {
  const st = useStore();
  const isCoach = st.role === 'coach';
  const isSub = st.role === 'sub';
  const P = playerMap(st.data.players);
  const posted = new Set(visiblePosts(st, st.data.posts, P).map((p) => p.eventId).filter(Boolean));
  const { upcoming, past } = splitEvents(allEvents(st.data));
  const list = (view === 'upcoming' ? upcoming : past).filter((e) => !isSub || posted.has(e.id));

  return (
    <>
      {(list.length > 0 || isCoach) && (
        <section className="section">
          <h2 className="h2">Arrangementer</h2>
          {!list.length && <p className="note">{view === 'upcoming' ? 'Ingen kommende arrangementer.' : 'Ingen tidligere arrangementer.'}</p>}
          <div className="list stagger">
            {list.map((e) => (
              <EventRow key={e.id} e={e} />
            ))}
          </div>
          {isCoach && view === 'upcoming' && (
            <button type="button" className="link-btn small start" style={{ marginTop: 6 }} onClick={() => st.openAddEvent()}>
              + Arrangement, f.eks. pizzakveld eller spillermøte
            </button>
          )}
        </section>
      )}
      {view === 'upcoming' && !isSub && <TrainingSeriesList />}
    </>
  );
}

/** The trainings that repeat every week, with buttons for the coach. */
function TrainingSeriesList() {
  const st = useStore();
  const isCoach = st.role === 'coach';
  const running = (st.data.trainings || []).filter((t) => isRunning(t));
  if (!running.length && !isCoach) return null;
  return (
    <section className="section">
      <h2 className="h2">Faste treninger</h2>
      <div className="list">
        {running.map((t) => (
          <div key={t.id} className="row">
            <span className="row-text">
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, font: 'italic 800 18px/1.15 var(--display)', textTransform: 'uppercase' }}>
                <Icon name="directions_run" size={20} style={{ color: 'var(--accent-ink)' }} />
                <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{t.title}</span>
              </span>
              <span className="row-sub">
                {repeatText(t)} kl. {timeText(t)} · {t.venue}
              </span>
              {t.until && <span className="row-meta">Til og med {fmtLong(t.until)}</span>}
              {isCoach && (
                <span style={{ display: 'flex', gap: 16, paddingTop: 4 }}>
                  <button type="button" className="link-btn small start" style={{ minHeight: 0, padding: 0 }} onClick={() => st.openTraining(t.id)}>
                    Endre
                  </button>
                  <button type="button" className="link-btn small start" style={{ minHeight: 0, padding: 0 }} onClick={() => st.endTraining(t.id)}>
                    Avslutt
                  </button>
                </span>
              )}
            </span>
            <button
              type="button"
              className="icon-btn"
              aria-label="Legg alle treningene i kalender"
              style={{ marginRight: -12, color: 'var(--accent-ink)' }}
              onClick={() => st.trainingToCal(t.id)}
            >
              <Icon name="event" />
            </button>
          </div>
        ))}
      </div>
      {isCoach && (
        <button type="button" className="link-btn small start" style={{ marginTop: 6 }} onClick={() => st.openTraining()}>
          + Fast trening, f.eks. hver onsdag
        </button>
      )}
    </section>
  );
}

function EventRow({ e }: { e: TeamEvent | TrainingEvent }) {
  const open = useStore((s) => s.openEventView);
  const media = useStore((s) => s.data.posts.reduce((n, p) => (p.eventId === e.id ? n + p.media.length : n), 0));
  const cancelled = isTraining(e) && e.cancelled;
  return (
    <button type="button" className="row-btn" style={{ minHeight: 72 }} onClick={() => open(e.id)}>
      <DateCol date={e.date} />
      <span className="row-text">
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, font: 'italic 800 18px/1.15 var(--display)', textTransform: 'uppercase' }}>
          <Icon name={e.icon || 'event'} size={20} style={{ color: 'var(--accent-ink)' }} />
          <span style={{ minWidth: 0, overflowWrap: 'anywhere', ...(cancelled ? { textDecoration: 'line-through', color: 'var(--muted)' } : {}) }}>{e.title}</span>
        </span>
        <span className="row-sub">{cancelled ? 'Avlyst' : eventHours(e) + ' · ' + e.venue}</span>
        {!cancelled && isTraining(e) && e.changed && <span className="row-meta">Endret denne gangen</span>}
        {e.kind !== e.title && <span className="row-meta">{e.kind}</span>}
        {media > 0 && <span className="row-meta">{media === 1 ? '1 bilde eller video' : media + ' bilder og videoer'}</span>}
      </span>
      <Icon name="chevron_right" style={{ color: 'var(--muted)' }} />
    </button>
  );
}

export function EventDetail({ id }: { id: string }) {
  const st = useStore();
  const e = findEvent(st.data, id);
  if (!e) return null;
  const training = isTraining(e) ? e : null;
  const isCoach = st.role === 'coach';
  const P = playerMap(st.data.players);
  const posts = visiblePosts(st, st.data.posts, P).filter((p) => p.eventId === e.id);
  return (
    <>
      <header className="app-header">
        <button
          type="button"
          onClick={st.closeEvent}
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
          Program
        </button>
      </header>
      <section className="card" style={{ padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: 12, animation: 'ic-rise 320ms var(--ease-out) both' }}>
        <div className="eyebrow" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--accent-ink)', textTransform: 'uppercase' }}>
          <Icon name={e.icon || 'event'} size={18} />
          {e.kind !== e.title ? e.kind : training ? 'Trening' : 'Hendelse'}
        </div>
        <h1 className="h1" style={{ margin: 0, overflowWrap: 'anywhere', ...(training?.cancelled ? { textDecoration: 'line-through' } : {}) }}>
          {e.title}
        </h1>
        {training?.cancelled && <p style={{ margin: 0, font: '700 15px var(--body)', color: 'var(--accent-ink)' }}>Denne treningen er avlyst.</p>}
        {training && !training.cancelled && training.changed && <p className="note" style={{ margin: 0 }}>Tid eller sted er endret denne gangen.</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, font: '400 15px/1.4 var(--body)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="calendar_today" size={18} style={{ color: 'var(--muted)' }} />
            <span style={{ textTransform: 'capitalize' }}>{fmtLong(e.date)}</span>
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="schedule" size={18} style={{ color: 'var(--muted)' }} />
            <span className="tnum">{eventHours(e)}</span>
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="location_on" size={18} style={{ color: 'var(--muted)' }} />
            {e.venue}
          </span>
        </div>
        <div className="btn-pair">
          <button type="button" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }} onClick={() => st.addEventToCal(e)}>
            <Icon name="event" size={18} />
            Kalender
          </button>
          <button type="button" className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }} onClick={() => st.showMap(e)}>
            <Icon name="location_on" size={18} />
            Vis kart
          </button>
        </div>
      </section>
      {isCoach && (
        <div style={{ margin: '12px 0 0', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
          {training ? (
            <>
              <button type="button" className="link-btn small" style={{ textAlign: 'left' }} onClick={() => st.openTrainingDay(training.seriesId, training.date)}>
                Flytt eller avlys denne gangen
              </button>
              <button type="button" className="link-btn small" style={{ textAlign: 'left' }} onClick={() => st.openTraining(training.seriesId)}>
                Endre alle treningene
              </button>
            </>
          ) : (
            <button type="button" className="link-btn small" style={{ textAlign: 'left' }} onClick={() => st.openAddEvent(e.id)}>
              Endre eller slett
            </button>
          )}
        </div>
      )}
      {canPost(st) && (
        <div style={{ marginTop: 12 }}>
          <PostPrompt label="Del bilder, video eller tekst herfra …" onClick={() => st.openComposer(null, e.id)} />
        </div>
      )}
      <Feed posts={posts} P={P} emptyText="Ingen innlegg fra denne hendelsen ennå." />
    </>
  );
}
