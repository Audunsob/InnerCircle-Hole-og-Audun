'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useStore } from '@/lib/store';
import type { Tab } from '@/lib/types';
import { Icon } from '../ui';
import { ArrangementView, EventDetail } from './ArrangementView';
import { KamperView, MatchDetail } from './KamperView';
import { LagView } from './LagView';
import { MinSide } from './MinSide';
import { OkonomiView } from './OkonomiView';

export function AppShell() {
  const tab = useStore((s) => s.tab);
  const openMatch = useStore((s) => s.openMatch);
  const openEvent = useStore((s) => s.openEvent);
  const isCoach = useStore((s) => s.role === 'coach');
  const setTab = useStore((s) => s.setTab);

  const tabs: [Tab, string, string][] = [
    ['lag', 'Lag', 'groups'],
    ['kamper', 'Kamper', 'sports_soccer'],
    ['arrangement', 'Annet', 'celebration'],
    ...(isCoach ? ([['okonomi', 'Økonomi', 'payments']] as [Tab, string, string][]) : []),
    ['min', 'Min side', 'person'],
  ];
  // Økonomi is coach-only; fall back to Lag if a saved tab no longer applies.
  const current: Tab = tab === 'okonomi' && !isCoach ? 'lag' : tab;

  const idx = tabs.findIndex(([k]) => k === current);
  // Remember the last tab so the new one slides in from the side it sits on.
  useEffect(() => {
    lastTab = idx;
  }, [idx]);
  const dir = idx >= lastTab ? 'right' : 'left';
  const view =
    current === 'kamper' && openMatch ? 'match:' + openMatch : current === 'arrangement' && openEvent ? 'event:' + openEvent : current;

  return (
    <>
      <div className="screen" style={{ padding: '0 16px calc(104px + env(safe-area-inset-bottom))' }}>
        <TabView key={view} dir={view.includes(':') ? 'right' : dir}>
          {current === 'lag' && <LagView />}
          {current === 'kamper' && (openMatch ? <MatchDetail id={openMatch} /> : <KamperView />)}
          {current === 'arrangement' && (openEvent ? <EventDetail id={openEvent} /> : <ArrangementView />)}
          {current === 'okonomi' && <OkonomiView />}
          {current === 'min' && <MinSide />}
        </TabView>
      </div>
      <nav aria-label="Hovedmeny" className="tabbar">
        <div className="tabbar-inner">
          {tabs.map(([k, label, icon]) => {
            const active = current === k;
            return (
              <button
                key={k}
                type="button"
                className="tabbar-btn"
                onClick={() => setTab(k)}
                aria-current={active ? 'page' : undefined}
              >
                <span className="tabbar-pill">
                  <Icon name={icon} size={22} filled={active} />
                </span>
                {label}
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}

let lastTab = 0;

/** One tab's content. The slide direction is fixed when it mounts, so later renders don't restart it. */
function TabView({ dir, children }: { dir: 'left' | 'right'; children: ReactNode }) {
  const [d] = useState(dir);
  return <div className={d === 'left' ? 'view-from-left' : 'view-from-right'}>{children}</div>;
}
