'use client';

import { useEffect } from 'react';
import { demoView, DEMO_TEAM_ID } from '@/lib/demo';
import { freshState } from '@/lib/seed';
import { setReadOnlyMessage, useStore } from '@/lib/store';
import { setDemo, setViewAs } from '@/lib/supabase';
import { Viewer } from '../overlays/Viewer';
import { AppShell } from '../app/AppShell';
import { SheetHost } from '../sheets/Sheets';
import { Icon } from '../ui';

// This file only loads in the browser (see DemoClient), so the demo team is set up once, before the first render.
{
  const v = demoView();
  setViewAs(v);
  setDemo(true);
  setReadOnlyMessage('Dette er bare en demo, så det går ikke her.');
  const fresh = freshState();
  useStore.setState({
    ...fresh,
    uid: 'demo',
    team: { id: DEMO_TEAM_ID, role: 'sub' },
    role: 'sub',
    version: v.payload.version,
    data: v.payload.data,
    screen: 'app',
    theme: useStore.getState().theme,
    seenNotifsAt: Date.now() - 24 * 3600e3,
    homeTip: true,
    onboarded: { sub: true },
    links: [],
    coaches: [],
    teams: v.teams,
    prof: { ...fresh.prof, sub: { ...fresh.prof.sub, name: 'Gjest', active: true, startedAt: Date.now() - 40 * 864e5 } },
  });
}

/**
 * The app at /demo, as a subscriber of a made-up team sees it. It uses the moderator's "se som" mode,
 * so nothing reaches the database and nothing is saved on the device. Hearts and comments change
 * what is on screen, as in the real app, until the page is reloaded.
 */
export default function DemoApp() {
  const toast = useStore((s) => s.toastMsg);
  const theme = useStore((s) => s.theme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <>
      <div role="status" className="mod-banner">
        <Icon name="visibility" />
        <span className="row-text">
          <span style={{ fontWeight: 700 }}>Demo av InnerCircle</span>
          <span style={{ fontSize: 12, opacity: 0.8 }}>Slik ser appen ut for en som følger laget. Trykk og prøv! Laget og bildene er oppdiktet.</span>
        </span>
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
