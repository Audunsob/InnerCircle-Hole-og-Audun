import { COACH, DEFAULT_PRICE, DEFAULT_TEAM } from './seed';
import type { AppState, Match, Player, Post, Role } from './types';

type S = Pick<AppState, 'data' | 'prof'>;

export const teamName = (s: S) => s.data.teamName || DEFAULT_TEAM;
export const shortTeam = (s: S) => teamName(s).split(' ')[0];

export const matchTitle = (s: S, m: Match) =>
  m.title || (m.home ? shortTeam(s) + ' – ' + m.opp : m.opp + ' – ' + shortTeam(s));

/** "Mot Lørenskog" — shown when a custom title hides who the opponent is. */
export const opponentText = (m: Match) => (m.title && m.opp ? 'Mot ' + m.opp : '');

/**
 * Practical team info (meeting time, messages to the team, training changes) is for those on the team:
 * coaches and players. Subscribers follow the team and don't need it.
 */
export const seesTeamInfo = (role: Role | null) => role !== 'sub';

export const price = (s: S) => s.data.price ?? DEFAULT_PRICE;
export const priceText = (s: S) => price(s) + ' kr';

export const codes = (s: S) => ({ team: s.data.teamCode || '', coach: s.data.coachCode || '' });

export const coachName = (s: S) => s.prof.coach?.name || COACH;

export const playerMap = (players: Player[]) => {
  const P: Record<string, Player> = {};
  players.forEach((p) => (P[p.id] = p));
  return P;
};

/**
 * Under 15, the player's own signature isn't enough: a parent must also sign the form. Older consents
 * where a parent said yes from their own login still count.
 */
export const missingParent = (p: Player | undefined) =>
  !!(p?.consent && p.consent.adult === false && !p.consent.parentSig && !p.consent.parentBy);
export const hasConsent = (p: Player | undefined) => !!(p && p.consent && p.consent.photo && !missingParent(p));

/** For the coach's overview: photos allowed, someone said no, a parent's signature missing, or nothing given yet. */
export type ConsentStatus = 'given' | 'declined' | 'parent' | 'none';
export const consentStatus = (p: Player): ConsentStatus =>
  hasConsent(p) ? 'given' : p.declined ? 'declined' : missingParent(p) ? 'parent' : 'none';
export const CONSENT_LABEL: Record<ConsentStatus, string> = {
  given: 'Samtykke gitt',
  declined: 'Sa nei',
  parent: 'Mangler foresatt',
  none: 'Ikke gitt',
};
export const CONSENT_INK: Record<ConsentStatus, string> = {
  given: 'var(--ok)',
  declined: 'var(--accent-ink)',
  parent: 'var(--muted)',
  none: 'var(--muted)',
};

/**
 * Older posts marked players in focus. Such a post is hidden as soon as one of them lacks consent
 * (or video consent for videos). New posts mark nobody.
 */
export const postAllowed = (P: Record<string, Player>, post: Post) =>
  post.tagged.every((id) => {
    const p = P[id];
    if (!p) return true;
    if (!hasConsent(p)) return false;
    if (post.media.some((m) => m.kind === 'video') && !p.consent!.video) return false;
    return true;
  });

type PostState = Pick<AppState, 'data' | 'prof' | 'role'>;

/**
 * Players aged 15 or more may post about a match the coaches made (the database checks the same).
 * A player counts as 15 or more when they signed the consent form as 15 or more, unless the year of birth says otherwise.
 */
export const canPost = (s: PostState) => {
  if (s.role === 'coach') return true;
  if (s.role !== 'player') return false;
  const me = s.data.players.find((p) => p.id === s.prof.player.playerId);
  return !!me?.consent?.adult && (me.born == null || new Date().getFullYear() - me.born >= 15);
};

/** Subscribers and players aged 15 or more may comment, like coaches (the database checks the same). */
export const canComment = (s: PostState) => s.role === 'sub' || canPost(s);

/** The name on a post from a player. Without consent to show the name, only the role. Set again by the database. */
export const memberAuthor = (s: PostState) => {
  const p = s.data.players.find((x) => x.id === s.prof.player.playerId);
  return { author: p?.consent?.name ? p.name : 'Spiller', authorRole: 'Spiller' };
};

/** Players who must not be in photos: no consent, they said no, or a parent's signature is missing. */
export const notInPhotos = (players: Player[]) => players.filter((p) => !hasConsent(p));
