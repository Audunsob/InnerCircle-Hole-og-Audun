import { DAY, iso } from './format';
import type { TeamData, TeamEvent, TrainingSeries } from './types';

/** Weekday names, indexed like Date.getDay(). */
export const WEEKDAYS = ['søndag', 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag'];
/** Monday first, the way Norwegian calendars show the week. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

/** One training in a series, with any change to that day applied. */
export interface Training {
  seriesId: string;
  /** The date the series planned it for, which names it in `changes` and in its id. */
  key: string;
  /** The date it is on: the planned date, or the day it was moved to. */
  date: string;
  title: string;
  time: string;
  end: string;
  venue: string;
  note: string;
  cancelled: boolean;
  /** Day, time or place differ from the rest of the series. */
  changed: boolean;
}

const noon = (date: string) => new Date(date + 'T12:00');
const addDays = (date: string, n: number) => {
  const d = noon(date);
  d.setDate(d.getDate() + n);
  return iso(d);
};

/** The first day on or after `date` that falls on `weekday`. */
export const firstOn = (date: string, weekday: number) => addDays(date, (weekday - noon(date).getDay() + 7) % 7);

/** "Hver onsdag", "Annenhver tirsdag". */
export const repeatText = (t: Pick<TrainingSeries, 'weekday' | 'every'>) =>
  (t.every === 2 ? 'Annenhver ' : 'Hver ') + WEEKDAYS[t.weekday];

export const timeText = (t: { time: string; end: string }) => (t.end ? t.time + '–' + t.end : t.time);

const daysBetween = (a: string, b: string) => Math.round((noon(b).getTime() - noon(a).getTime()) / DAY);

/** The series has a training planned on this date (before any move). */
export function isPlanned(t: TrainingSeries, date: string) {
  const first = firstOn(t.from, t.weekday);
  if (date < first || (t.until && date > t.until)) return false;
  return daysBetween(first, date) % (7 * (t.every || 1)) === 0;
}

/** The training planned for `key`, with its change applied. */
function training(t: TrainingSeries, key: string): Training {
  const c = t.changes?.[key] || {};
  const date = c.date || key;
  const time = c.time || t.time;
  const end = c.end ?? t.end;
  const venue = c.venue || t.venue;
  const note = c.note ?? t.note ?? '';
  return {
    seriesId: t.id,
    key,
    date,
    title: t.title,
    time,
    end,
    venue,
    note,
    cancelled: !!c.cancelled,
    changed: date !== key || time !== t.time || end !== t.end || venue !== t.venue,
  };
}

/** The training the series planned for this date, wherever it was moved; undefined if none was planned then. */
export const occurrenceOn = (t: TrainingSeries, key: string) => (isPlanned(t, key) ? training(t, key) : undefined);

/** Trainings in a series that fall from one day to another, both included, by the day they are on. */
export function occurrences(t: TrainingSeries, fromDate: string, toDate: string): Training[] {
  const out: Training[] = [];
  const last = t.until && t.until < toDate ? t.until : toDate;
  const step = 7 * (t.every || 1);
  let d = firstOn(t.from, t.weekday);
  // Jump close to the start of the range without walking through every past week.
  if (d < fromDate) {
    const weeks = Math.floor(daysBetween(d, fromDate) / step);
    d = addDays(d, weeks * step);
    if (d < fromDate) d = addDays(d, step);
  }
  for (; d <= last; d = addDays(d, step)) {
    const moved = t.changes?.[d]?.date;
    // A training moved to another day is counted where it ended up, below.
    if (!moved || moved === d) out.push(training(t, d));
  }
  for (const [key, c] of Object.entries(t.changes || {})) {
    if (c.date && c.date !== key && c.date >= fromDate && c.date <= toDate && isPlanned(t, key)) out.push(training(t, key));
  }
  return out.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
}

/** Trainings from today and the coming weeks, across all series, soonest first. */
export function upcomingTrainings(series: TrainingSeries[] | undefined, weeks = 6, now = new Date()): Training[] {
  const today = iso(now);
  const to = addDays(today, weeks * 7);
  const nowTime = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  return (series || [])
    .flatMap((t) => occurrences(t, today, to))
    // Today's training stays until it is over.
    .filter((x) => x.date > today || (x.end || x.time) > nowTime)
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
}

/** The series still has trainings ahead. */
export const isRunning = (t: TrainingSeries, now = new Date()) => !t.until || t.until >= iso(now);

/** Calendar file for the whole series, repeating, without the cancelled days and with single trainings that were moved. */
export function seriesIcs(t: TrainingSeries, teamName: string) {
  const local = (date: string, time: string) => date.replace(/-/g, '') + 'T' + time.replace(':', '') + '00';
  const first = firstOn(t.from, t.weekday);
  const rule = ['FREQ=WEEKLY', 'INTERVAL=' + (t.every || 1)];
  if (t.until) rule.push('UNTIL=' + t.until.replace(/-/g, '') + 'T235959Z');
  const changed = Object.keys(t.changes || {}).filter((key) => isPlanned(t, key));
  const cancelled = changed
    .filter((key) => t.changes[key].cancelled)
    .map((key) => 'EXDATE;TZID=Europe/Oslo:' + local(key, t.time));
  const esc = (v: string) => v.replace(/\\/g, '\\\\').replace(/[,;]/g, (m) => '\\' + m).replace(/\n/g, '\\n');
  const stamp = 'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const event = (date: string, time: string, end: string, venue: string, extra: string[]) => [
    'BEGIN:VEVENT',
    'UID:' + t.id + '@innercircle.no',
    stamp,
    ...extra,
    'DTSTART;TZID=Europe/Oslo:' + local(date, time),
    'DTEND;TZID=Europe/Oslo:' + local(date, end || addMinutes(time, 90)),
    'SUMMARY:' + esc(t.title + ' (' + teamName + ')'),
    'LOCATION:' + esc(venue),
    'END:VEVENT',
  ];
  // A moved training replaces the planned one: same UID, with the planned start as RECURRENCE-ID.
  const moved = changed
    .map((key) => training(t, key))
    .filter((x) => !x.cancelled && x.changed)
    .flatMap((x) => event(x.date, x.time, x.end, x.venue, ['RECURRENCE-ID;TZID=Europe/Oslo:' + local(x.key, t.time)]));
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//InnerCircle//NO',
    ...event(first, t.time, t.end, t.venue, ['RRULE:' + rule.join(';'), ...cancelled]),
    ...moved,
    'END:VCALENDAR',
  ].join('\r\n');
}

function addMinutes(time: string, n: number) {
  const [h, m] = time.split(':').map(Number);
  const t = (h * 60 + m + n) % (24 * 60);
  return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0');
}

export const yesterday = (now = new Date()) => addDays(iso(now), -1);

/** The date `n` days after (or before) a yyyy-mm-dd date. */
export const addDaysIso = addDays;

/** A training from a series, shaped like the team's other events. `key` is the date the series planned it for. */
export type TrainingEvent = TeamEvent & { seriesId: string; key: string; cancelled: boolean; changed: boolean };

/** One training's id: the series id and the date, like "t1760300000000:2026-10-14". */
export const trainingEventId = (seriesId: string, date: string) => seriesId + ':' + date;

const asEvent = (x: Training): TrainingEvent => ({
  id: trainingEventId(x.seriesId, x.key),
  kind: 'Trening',
  icon: 'directions_run',
  title: x.title,
  date: x.date,
  time: x.time,
  end: x.end || undefined,
  venue: x.venue,
  note: x.note || undefined,
  seriesId: x.seriesId,
  key: x.key,
  cancelled: x.cancelled,
  changed: x.changed,
});

/** Trainings from the series, some weeks back and some weeks ahead, as events. */
export function trainingEvents(series: TrainingSeries[] | undefined, back = 8, ahead = 6, now = new Date()): TrainingEvent[] {
  const today = iso(now);
  return (series || []).flatMap((t) => occurrences(t, addDays(today, -back * 7), addDays(today, ahead * 7)).map(asEvent));
}

/** The team's events with the trainings from the series mixed in. */
export const allEvents = (data: Pick<TeamData, 'events' | 'trainings'>): (TeamEvent | TrainingEvent)[] => [
  ...(data.events || []),
  ...trainingEvents(data.trainings),
];

/** An event by id, also a single training from a series, however long ago. */
export function findEvent(data: Pick<TeamData, 'events' | 'trainings'>, id: string | null | undefined): TeamEvent | TrainingEvent | undefined {
  if (!id) return undefined;
  const e = (data.events || []).find((x) => x.id === id);
  if (e) return e;
  const [seriesId, date] = id.split(':');
  const t = date && (data.trainings || []).find((x) => x.id === seriesId);
  if (!t) return undefined;
  const x = occurrenceOn(t, date);
  return x && asEvent(x);
}

export const isTraining = (e: TeamEvent | TrainingEvent | undefined): e is TrainingEvent => !!e && 'cancelled' in e;
