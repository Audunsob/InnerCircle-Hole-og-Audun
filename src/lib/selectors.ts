import { COACH, DEFAULT_PRICE, DEFAULT_TEAM } from './seed';
import type { AppState, Match, Player, Post } from './types';

type S = Pick<AppState, 'data' | 'prof'>;

export const teamName = (s: S) => s.data.teamName || DEFAULT_TEAM;
export const shortTeam = (s: S) => teamName(s).split(' ')[0];

export const matchTitle = (s: S, m: Match) =>
  m.title || (m.home ? shortTeam(s) + ' – ' + m.opp : m.opp + ' – ' + shortTeam(s));

/** "Mot Lørenskog" — shown when a custom title hides who the opponent is. */
export const opponentText = (m: Match) => (m.title && m.opp ? 'Mot ' + m.opp : '');

export const price = (s: S) => s.data.price ?? DEFAULT_PRICE;
export const priceText = (s: S) => price(s) + ' kr';

export const codes = (s: S) => ({ team: s.data.teamCode || '', coach: s.data.coachCode || '' });

export const coachName = (s: S) => s.prof.coach?.name || COACH;

export const playerMap = (players: Player[]) => {
  const P: Record<string, Player> = {};
  players.forEach((p) => (P[p.id] = p));
  return P;
};

/** Under 15, the player's own signature isn't enough: a parent must say yes from their own login. */
export const waitsForParent = (p: Player | undefined) => !!(p?.consent && p.consent.adult === false && !p.consent.parentBy);
export const hasConsent = (p: Player | undefined) => !!(p && p.consent && p.consent.photo && !waitsForParent(p));

/** For the coach's overview: photos allowed, someone said no, waiting for a parent, or nothing given yet. */
export type ConsentStatus = 'given' | 'declined' | 'parent' | 'none';
export const consentStatus = (p: Player): ConsentStatus =>
  hasConsent(p) ? 'given' : p.declined ? 'declined' : waitsForParent(p) ? 'parent' : 'none';
export const CONSENT_LABEL: Record<ConsentStatus, string> = {
  given: 'Samtykke gitt',
  declined: 'Sa nei',
  parent: 'Venter på foresatt',
  none: 'Ikke gitt',
};
export const CONSENT_INK: Record<ConsentStatus, string> = {
  given: 'var(--ok)',
  declined: 'var(--accent-ink)',
  parent: 'var(--muted)',
  none: 'var(--muted)',
};

/** A post is hidden as soon as anyone tagged in it lacks consent (or video consent for videos). */
export const postAllowed = (P: Record<string, Player>, post: Post) =>
  post.tagged.every((id) => {
    const p = P[id];
    if (!p) return true;
    if (!hasConsent(p)) return false;
    if (post.media.some((m) => m.kind === 'video') && !p.consent!.video) return false;
    return true;
  });
