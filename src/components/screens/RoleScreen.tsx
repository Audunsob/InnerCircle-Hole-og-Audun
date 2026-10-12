'use client';

import { useStore } from '@/lib/store';
import { ChevronRow, Icon } from '../ui';

/** Thin gold rings, the circle from the logo. */
export function Rings({ size, style }: { size: number; style?: React.CSSProperties }) {
  const c = size / 2;
  return (
    <svg aria-hidden="true" className="rings" width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none" stroke="currentColor" style={style}>
      <circle cx={c} cy={c} r={c - 10} strokeWidth="1.5" />
      <circle cx={c} cy={c} r={c * 0.7} strokeWidth="1" />
      <circle cx={c} cy={c} r={c * 0.46} strokeWidth="0.75" />
    </svg>
  );
}

export function RoleScreen() {
  const theme = useStore((s) => s.theme);
  const toggleTheme = useStore((s) => s.toggleTheme);
  const chooseRole = useStore((s) => s.chooseRole);

  return (
    <div className="screen view-enter" style={{ position: 'relative', overflow: 'hidden', padding: '0 20px calc(24px + env(safe-area-inset-bottom))' }}>
      <Rings size={420} style={{ top: -110, right: -170 }} />
      <div style={{ position: 'relative', minHeight: 72, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span
          style={{
            width: 34,
            height: 34,
            borderRadius: '50%',
            border: '1px solid var(--gold)',
            background: 'var(--brand)',
            color: '#f5ede3',
            display: 'grid',
            placeItems: 'center',
            font: '500 15px var(--serif)',
          }}
          aria-hidden="true"
        >
          IC
        </span>
        <span className="wordmark" style={{ flex: 1 }}>
          InnerCircle
        </span>
        <button type="button" className="icon-btn" onClick={toggleTheme} aria-label="Bytt mellom lys og mørk modus" style={{ marginRight: -8 }}>
          <Icon name={theme === 'dark' ? 'light_mode' : 'dark_mode'} />
        </button>
      </div>
      <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 14, padding: '48px 0 32px' }}>
        <div className="eyebrow" style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, letterSpacing: '.22em' }}>
          <span style={{ width: 28, height: 1.5, background: 'var(--gold)' }} />
          Privat lagstrøm
        </div>
        <h1 style={{ margin: 0, font: 'italic 800 60px/0.9 var(--display)', textTransform: 'uppercase', maxWidth: 340, textWrap: 'balance' }}>
          Lagets egen bildestrøm
        </h1>
        <p style={{ margin: 0, font: 'italic 500 24px/1.2 var(--serif)', color: 'var(--muted)' }}>– bare for familien</p>
      </div>
      <nav aria-label="Velg rolle" className="stagger" style={{ position: 'relative' }}>
        <ChevronRow large num="01" arrow="arrow_forward" title="Jeg er spiller" sub="Over eller under 15 år" onClick={() => chooseRole('player')} />
        <ChevronRow
          large
          num="02"
          arrow="arrow_forward"
          title="Jeg er foresatt"
          sub="Gratis: se bildene der barnet ditt er med"
          onClick={() => chooseRole('parent')}
        />
        <ChevronRow
          large
          num="03"
          arrow="arrow_forward"
          title="Jeg er abonnent"
          sub="Besteforeldre, tanter, onkler og andre som heier"
          onClick={() => chooseRole('sub')}
        />
        <ChevronRow large num="04" arrow="arrow_forward" title="Jeg er trener" sub="Trener eller lagleder" onClick={() => chooseRole('coach')} />
      </nav>
      <p className="note" style={{ position: 'relative', marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
        <Icon name="lock" size={16} style={{ color: 'var(--gold)' }} />
        Ingenting er offentlig. Bare de som er invitert, ser bildene.
      </p>
    </div>
  );
}
