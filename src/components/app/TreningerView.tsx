'use client';

import { fmtLong } from '@/lib/format';
import { useStore } from '@/lib/store';
import { isRunning, repeatText, timeText, upcomingTrainings } from '@/lib/trainings';
import { DateCol, Icon } from '../ui';

/** Trainings that repeat every week, and the next ones coming up. */
export function TreningerView() {
  const st = useStore();
  const isCoach = st.role === 'coach';
  const series = st.data.trainings || [];
  const running = series.filter((t) => isRunning(t));
  const next = upcomingTrainings(running);

  if (!running.length)
    return (
      <div style={{ padding: '40px 0', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <p className="note" style={{ margin: 0 }}>
          Ingen faste treninger er lagt inn.
        </p>
        {isCoach && (
          <button type="button" className="btn-outline" onClick={() => st.openTraining()}>
            + Fast trening
          </button>
        )}
      </div>
    );

  return (
    <>
      <section className="section">
        <h2 className="h2">Faste treninger</h2>
        <div className="list">
          {running.map((t) => (
            <div key={t.id} className="row">
              <span className="row-text">
                <span style={{ font: 'italic 800 18px/1.15 var(--display)', textTransform: 'uppercase' }}>{t.title}</span>
                <span className="row-sub">
                  {repeatText(t)} kl. {timeText(t)}
                </span>
                <span className="row-sub">{t.venue}</span>
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
                aria-label="Legg i kalender"
                style={{ marginRight: -12, color: 'var(--accent-ink)' }}
                onClick={() => st.trainingToCal(t.id)}
              >
                <Icon name="event" />
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <h2 className="h2">Neste treninger</h2>
        {!next.length && <p className="note">Ingen treninger de neste ukene.</p>}
        <div className="list stagger">
          {next.map((x) => {
            const body = (
              <>
                <DateCol date={x.date} accent={x.changed && !x.cancelled} />
                <span className="row-text">
                  <span
                    style={{
                      font: 'italic 800 18px/1.15 var(--display)',
                      textTransform: 'uppercase',
                      ...(x.cancelled ? { textDecoration: 'line-through', color: 'var(--muted)' } : {}),
                    }}
                  >
                    {x.title}
                  </span>
                  <span className="row-sub">
                    {x.cancelled ? 'Avlyst' : 'Kl. ' + timeText(x) + ' · ' + x.venue}
                  </span>
                  {!x.cancelled && x.changed && <span className="row-meta">Endret denne gangen</span>}
                  {!x.cancelled && x.note && (
                    <span className="row-sub" style={{ whiteSpace: 'pre-wrap' }}>
                      {x.note}
                    </span>
                  )}
                </span>
              </>
            );
            return isCoach ? (
              <button key={x.seriesId + x.date} type="button" className="row-btn" onClick={() => st.openTrainingDay(x.seriesId, x.date)}>
                {body}
                <Icon name="chevron_right" size={20} />
              </button>
            ) : (
              <div key={x.seriesId + x.date} className="row">
                {body}
              </div>
            );
          })}
        </div>
        {isCoach && next.length > 0 && <p className="note">Trykk på en trening for å endre tid eller sted, eller avlyse bare den gangen.</p>}
      </section>
    </>
  );
}
