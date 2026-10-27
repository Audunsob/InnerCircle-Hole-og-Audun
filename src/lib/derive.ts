import { isPlayed, matchTime } from './format';
import { postAllowed, shortTeam } from './selectors';
import type { AppState, Match, Player, Post, TeamEvent } from './types';

export type Outcome = 'S' | 'U' | 'T';

export const hasResult = (m: Match) => m.us != null && m.them != null;

export const outcomeOf = (m: Match): Outcome | null =>
  !hasResult(m) ? null : m.us! > m.them! ? 'S' : m.us! < m.them! ? 'T' : 'U';

export const OUTCOME_WORD: Record<Outcome, string> = { S: 'Seier', U: 'Uavgjort', T: 'Tap' };
export const OUTCOME_COLOR: Record<Outcome, string> = { S: 'var(--win)', U: 'var(--draw)', T: 'var(--loss)' };

/** Score with the home team first. */
export const scoreText = (m: Match) => (m.home ? m.us + '–' + m.them : m.them + '–' + m.us);

export const scoreTitle = (s: Pick<AppState, 'data' | 'prof'>, m: Match) =>
  m.home ? shortTeam(s) + ' ' + m.us + '–' + m.them + ' ' + m.opp : m.opp + ' ' + m.them + '–' + m.us + ' ' + shortTeam(s);

export const homeAway = (m: Match) => (m.home ? 'Hjemme' : 'Borte');

export const photoText = (n: number) => (n === 1 ? '1 bilde' : n + ' bilder');

export function splitMatches(matches: Match[]) {
  const sorted = [...matches].sort((a, b) => matchTime(a) - matchTime(b));
  const upcoming = sorted.filter((m) => !isPlayed(m));
  const past = sorted.filter(isPlayed).reverse();
  const next = upcoming.find((m) => m.featured) || upcoming[0] || null;
  const later = upcoming.filter((m) => m !== next);
  return { upcoming, past, next, later };
}

/** A match that started in the last three days and has no result yet, newest first: the coach is reminded to enter it. */
export const awaitingResult = (matches: Match[], now = Date.now()) =>
  splitMatches(matches).past.find((m) => !hasResult(m) && now - matchTime(m) < 3 * 864e5);

/** Posts the viewer may see: older posts with a player in focus who lacks consent are hidden. */
export const visiblePosts = (_viewer: Pick<AppState, 'role'>, posts: Post[], P: Record<string, Player>) =>
  posts.filter((p) => postAllowed(P, p));

export const matchPhotoCount = (allowed: Post[], matchId: string) =>
  allowed.filter((p) => p.matchId === matchId).reduce((n, p) => n + p.media.length, 0);

export const eventTime = (e: TeamEvent) => new Date(e.date + 'T' + (e.time || '12:00')).getTime();

/** When it's over: the end time if there is one, else two hours after the start. */
const eventOver = (e: TeamEvent) =>
  e.end && e.end > e.time ? new Date(e.date + 'T' + e.end).getTime() : eventTime(e) + 2 * 3600e3;

/** Coming events soonest first, and past ones newest first. An event under way still counts as coming. */
export function splitEvents(events: TeamEvent[] | undefined) {
  const now = Date.now();
  const sorted = [...(events || [])].sort((a, b) => eventTime(a) - eventTime(b));
  return { upcoming: sorted.filter((e) => eventOver(e) >= now), past: sorted.filter((e) => eventOver(e) < now).reverse() };
}

/** "18:00" or "18:00–20:00". */
export const eventHours = (e: TeamEvent) => (e.end ? e.time + '–' + e.end : e.time);
