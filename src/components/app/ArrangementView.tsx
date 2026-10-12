'use client';

import { useState } from 'react';
import { eventHours, splitEvents, visiblePosts } from '@/lib/derive';
import { fmtLong } from '@/lib/format';
import { playerMap } from '@/lib/selectors';
import { useStore } from '@/lib/store';
import type { TeamEvent } from '@/lib/types';
import { DateCol, Icon, Tabs } from '../ui';
import { Feed } from './LagView';


/** Pizza nights, meetings, trainings: everything on the calendar that isn't a match. */
export function ArrangementView() {
  const st = useStore();
  const isCoach = st.role === 'coach';
  const [view, setView] = useState<'upcoming' | 'past'>('upcoming');
  const { upcoming, past } = splitEvents(st.data.events);
  const list = view === 'upcoming' ? upcoming : past;

  return (
    <>
      <header className="app-header">
        <div className="app-title" style={{ flex: 1, minWidth: 0 }}>
          Hendelser
        </div>
        {isCoach && (
          <button type="button" className="btn-outline" onClick={() => st.openAddEvent()}>
            + Nytt
          </button>
        )}
      </header>
      <Tabs
        value={view}
        items={[
          ['upcoming', 'Kommende'],
          ['past', 'Tidligere'],
        ]}
        onChange={setView}
      />
      {!list.length && (
        <p className="note" style={{ padding: '40px 0', textAlign: 'center' }}>
          {view === 'upcoming'
            ? isCoach
              ? 'Ingen kommende hendelser. Trykk «+ Nytt» for å legge inn pizzakveld, spillermøte eller noe annet.'
              : 'Ingen kommende hendelser er lagt inn.'
            : 'Ingen tidligere hendelser.'}
        </p>
      )}
      <div className="list stagger" style={{ paddingTop: 8 }}>
        {list.map((e) => (
          <EventRow key={e.id} e={e} />
        ))}
      </div>
    </>
  );
}

function EventRow({ e }: { e: TeamEvent }) {
  const open = useStore((s) => s.openEventView);
  return (
    <button type="button" className="row-btn" style={{ minHeight: 72 }} onClick={() => open(e.id)}>
      <DateCol date={e.date} />
      <span className="row-text">
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, font: 'italic 800 18px/1.15 var(--display)', textTransform: 'uppercase' }}>
          <Icon name={e.icon || 'event'} size={20} style={{ color: 'var(--accent-ink)' }} />
          <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{e.title}</span>
        </span>
        <span className="row-sub">
          {eventHours(e)} · {e.venue}
        </span>
        {e.kind !== e.title && <span className="row-meta">{e.kind}</span>}
      </span>
      <Icon name="chevron_right" style={{ color: 'var(--muted)' }} />
    </button>
  );
}

export function EventDetail({ id }: { id: string }) {
  const st = useStore();
  const e = (st.data.events || []).find((x) => x.id === id);
  if (!e) return null;
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
          Hendelser
        </button>
      </header>
      <section className="card" style={{ padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: 12, animation: 'ic-rise 320ms var(--ease-out) both' }}>
        <div className="eyebrow" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--accent-ink)', textTransform: 'uppercase' }}>
          <Icon name={e.icon || 'event'} size={18} />
          {e.kind}
        </div>
        <h1 className="h1" style={{ margin: 0, overflowWrap: 'anywhere' }}>
          {e.title}
        </h1>
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
        {e.note && <p style={{ margin: 0, font: '400 14px/1.5 var(--body)', color: 'var(--muted)', whiteSpace: 'pre-wrap' }}>{e.note}</p>}
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
        <div style={{ margin: '12px 0', display: 'flex', alignItems: 'center', gap: 16 }}>
          <button type="button" className="link-btn small" style={{ flex: 1, textAlign: 'left' }} onClick={() => st.openAddEvent(e.id)}>
            Endre eller slett
          </button>
          <button type="button" className="btn-outline" onClick={() => st.openComposer(null, e.id)}>
            + Innlegg
          </button>
        </div>
      )}
      <Feed posts={posts} P={P} emptyText="Ingen innlegg fra denne hendelsen ennå." />
    </>
  );
}
