import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { TeamData } from './types';

// Project "InnerCircle". Both values are public (they ship to the browser anyway), so they are
// built in. Hosting integrations can set NEXT_PUBLIC_SUPABASE_* to a different project, which
// splits accounts across two databases, so those variables are deliberately not read.
export const SUPABASE_URL = 'https://mabuooolvmijveepqbcu.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_lt6qAZNcNpPr5GVXmfF1vQ_XsujqNkN';

let client: SupabaseClient | null = null;
export const db = () => {
  if (!client) client = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
  return client;
};

export type MemberRole = 'coach' | 'player' | 'sub';

export interface TeamPayload {
  teamId: string;
  role: MemberRole;
  version: number;
  data: TeamData;
  ok?: boolean;
}

export interface TeamPeek {
  teamId: string;
  teamName: string;
  isCoachCode: boolean;
  /** taken: already linked to another account as the player. */
  players: { id: string; name: string; taken?: boolean }[];
}

/** What joining as a player returns while a coach hasn't approved it yet. */
export interface PendingJoin {
  pending: true;
  teamId: string;
  teamName: string;
  role: MemberRole;
}

/** An account linked to a player on the team, for the coach. */
export interface TeamLink {
  userId: string;
  role: 'player';
  playerId: string;
  status: 'pending' | 'active';
  email: string | null;
  at: string;
}

/** A coach on the team, for the other coaches. name and signedAt come from the coach rules they signed. */
export interface TeamCoach {
  userId: string;
  email: string | null;
  at: string;
  me: boolean;
  name: string | null;
  signedAt: number | null;
}

/** Thrown when the player is already linked to another account. */
export class PlayerTakenError extends Error {}

export interface Membership {
  teamId: string;
  role: MemberRole;
  playerId: string | null;
  teamName: string;
  /** Missing before the database had approvals; treat that as active. */
  status?: 'pending' | 'active';
}

/** Thrown when the only coach on a team tries to leave it or delete their account. team: the team's name, when known. */
export class LastCoachError extends Error {
  constructor(message: string, public team: string | null) {
    super(message);
  }
}

/** Thrown when a code is already used by another team. */
export class CodeTakenError extends Error {}

async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await db().rpc(fn, args);
  if (error) {
    if (/code_taken/.test(error.message)) throw new CodeTakenError(error.message);
    if (/player_taken/.test(error.message)) throw new PlayerTakenError(error.message);
    const last = /last_coach(?::(.*))?/.exec(error.message);
    if (last) throw new LastCoachError(error.message, last[1]?.trim() || null);
    throw new Error(error.message);
  }
  return data as T;
}

// ---------- Login ----------

/**
 * Emails a login link (and a 6-digit code if the email template includes {{ .Token }}).
 * Creates the account the first time. The link brings the person back to this site, signed in.
 */
export async function sendCode(email: string) {
  const { error } = await db().auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true, emailRedirectTo: window.location.origin + '/' },
  });
  if (error) throw new Error(error.message);
}

/** Calls back whenever this device becomes signed in, including from a login link. */
export function onSignedIn(cb: (id: string, email: string) => void) {
  const { data } = db().auth.onAuthStateChange((event, session) => {
    if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
      cb(session.user.id, (session.user.email || '').toLowerCase());
    }
  });
  return () => data.subscription.unsubscribe();
}

/**
 * Signs in from the login email's link (/?token_hash=…&type=email). The link only opens the app;
 * the token is used here, in the browser, so mail scanners that open links can't use it up and
 * make the 6-digit code in the same email stop working.
 */
export async function verifyLink(tokenHash: string, type: string): Promise<string> {
  const { data, error } = await db().auth.verifyOtp({
    token_hash: tokenHash,
    type: type === 'signup' ? 'signup' : type === 'magiclink' ? 'magiclink' : 'email',
  });
  if (error || !data.user) throw new Error(error?.message || 'Ugyldig lenke');
  return (data.user.email || '').toLowerCase();
}

/** Checks the code and signs in. Returns the account id. */
export async function verifyCode(email: string, token: string): Promise<string> {
  const { data, error } = await db().auth.verifyOtp({ email, token, type: 'email' });
  if (error || !data.user) throw new Error(error?.message || 'Feil kode');
  return data.user.id;
}

export async function currentUserId(): Promise<string | null> {
  try {
    const { data } = await db().auth.getSession();
    return data.session?.user.id ?? null;
  } catch {
    return null;
  }
}

/** The signed-in account on this device, if any. */
export async function currentSession(): Promise<{ id: string; email: string } | null> {
  try {
    const { data } = await db().auth.getSession();
    const u = data.session?.user;
    return u ? { id: u.id, email: (u.email || '').toLowerCase() } : null;
  } catch {
    return null;
  }
}

export async function signOut() {
  try {
    await db().auth.signOut();
  } catch {}
}

/** The current access token, for calls to our own API routes. */
export async function accessToken(): Promise<string | null> {
  const { data } = await db().auth.getSession();
  return data.session?.access_token ?? null;
}

// ---------- Teams ----------

export const peekTeam = (code: string) => rpc<TeamPeek | null>('peek_team', { p_code: code });
export const joinTeam = (code: string, role: MemberRole, playerId: string | null) =>
  rpc<TeamPayload | PendingJoin | null>('join_team', { p_code: code, p_role: role, p_player_id: playerId });
export const createTeam = (name: string, coachCode: string, teamCode: string, data: TeamData) =>
  rpc<TeamPayload>('create_team', { p_name: name, p_coach_code: coachCode, p_team_code: teamCode, p_data: data });
// The parent role is gone. A database that still has parents linked returns them; they are left out here.
export const myTeams = async () => (await rpc<(Membership | { role: 'parent' })[]>('my_teams')).filter((m): m is Membership => m.role !== 'parent');
export const getTeam = (teamId: string, role: MemberRole) => rpc<TeamPayload>('get_team', { p_team: teamId, p_role: role });
export const teamVersion = (teamId: string) => rpc<number | null>('team_version', { p_team: teamId });

export const teamLinks = async (teamId: string) =>
  (await rpc<(TeamLink | { role: 'parent' })[]>('team_links', { p_team: teamId })).filter((l): l is TeamLink => l.role === 'player');
export const teamCoaches = (teamId: string) => rpc<TeamCoach[]>('team_coaches', { p_team: teamId });
export const decideLink = (teamId: string, userId: string, role: 'player', approve: boolean) =>
  rpc<void>('decide_link', { p_team: teamId, p_user: userId, p_role: role, p_approve: approve });

/** Coach: renames the team and/or replaces its codes. Throws CodeTakenError if another team uses a code. */
export const updateTeam = (teamId: string, name: string, teamCode: string, coachCode: string) =>
  rpc<TeamPayload>('update_team', { p_team: teamId, p_name: name, p_team_code: teamCode, p_coach_code: coachCode });

/** Leaves the team in this role. The only coach can't (LastCoachError). */
export const leaveTeam = (teamId: string, role: MemberRole) => rpc<void>('leave_team', { p_team: teamId, p_role: role });
/** Deletes the signed-in account everywhere. Not while it is the only coach on a team (LastCoachError). */
export const deleteMe = () => rpc<void>('delete_me');
/** Coach: removes another coach from the team. */
export const removeCoach = (teamId: string, userId: string) => rpc<void>('remove_coach', { p_team: teamId, p_user: userId });
/** Coach: deletes the team for everyone. `confirm` must be the team's name. */
export const deleteTeam = (teamId: string, confirm: string) => rpc<void>('delete_team', { p_team: teamId, p_confirm: confirm });

/** Coach: deletes every file in the team's folder and its signature folder. Best effort; never throws. */
export async function deleteTeamFiles(teamId: string) {
  const bucket = db().storage.from('media');
  for (const folder of [teamId, teamId + '/sig']) {
    try {
      for (let round = 0; round < 100; round++) {
        const { data, error } = await bucket.list(folder, { limit: 100 });
        // Subfolders are listed without an id; their files are removed in their own round.
        const files = (data || []).filter((f) => f.id);
        if (error || !files.length) break;
        const { error: rmError } = await bucket.remove(files.map((f) => folder + '/' + f.name));
        if (rmError) break;
      }
    } catch {}
  }
}

/** Saves if `version` is still current; otherwise returns ok=false and the newer document. */
export const saveTeam = (teamId: string, role: MemberRole, version: number, data: TeamData) =>
  rpc<TeamPayload>('save_team', { p_team: teamId, p_role: role, p_version: version, p_data: data });

// ---------- Photos, videos and signatures ----------

/** Files are stored privately in the team's folder. Posts keep this prefix + path. */
export const STORAGE_PREFIX = 'sb:';

const dataUrlToBlob = async (dataUrl: string) => (await fetch(dataUrl)).blob();

const EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
};

/** Uploads to the team's private folder and returns a reference ("sb:<path>") to store in the team document. */
/** folder 'sig' is for signatures, which only the team's coaches and the uploader can open. */
export async function uploadMedia(teamId: string, src: string | Blob, folder?: 'sig'): Promise<string> {
  const blob = typeof src === 'string' ? await dataUrlToBlob(src) : src;
  const type = blob.type || 'image/jpeg';
  const path = `${teamId}/${folder ? folder + '/' : ''}${crypto.randomUUID()}.${EXT[type] || 'bin'}`;
  const { error } = await db().storage.from('media').upload(path, blob, { contentType: type, cacheControl: '31536000' });
  if (error) throw new Error(error.message);
  return STORAGE_PREFIX + path;
}

// Signed links last an hour; we refresh them a few minutes early.
const TTL = 3600;
const signed = new Map<string, { url: string; exp: number }>();
const waiting = new Map<string, Promise<string | null>>();
let queue: string[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let resolvers = new Map<string, (u: string | null) => void>();

async function flushSign() {
  const paths = queue;
  const res = resolvers;
  queue = [];
  resolvers = new Map();
  timer = null;
  try {
    const { data, error } = await db().storage.from('media').createSignedUrls(paths, TTL);
    if (error) throw error;
    const exp = Date.now() + (TTL - 300) * 1000;
    for (const item of data || []) {
      if (item.path && item.signedUrl) signed.set(item.path, { url: item.signedUrl, exp });
    }
  } catch {}
  for (const p of paths) {
    waiting.delete(p);
    res.get(p)?.(signed.get(p)?.url ?? null);
  }
}

/** Turns a stored media reference into a link the browser can load. Plain URLs and data URLs pass through. */
export function mediaUrl(src: string): Promise<string | null> {
  if (!src.startsWith(STORAGE_PREFIX)) return Promise.resolve(src);
  const path = src.slice(STORAGE_PREFIX.length);
  const hit = signed.get(path);
  if (hit && hit.exp > Date.now()) return Promise.resolve(hit.url);
  const pending = waiting.get(path);
  if (pending) return pending;
  const p = new Promise<string | null>((resolve) => {
    queue.push(path);
    resolvers.set(path, resolve);
    if (!timer) timer = setTimeout(flushSign, 30);
  });
  waiting.set(path, p);
  return p;
}

/** Cached link if we already have a fresh one (lets images render without a flash). */
export function cachedMediaUrl(src: string): string | null {
  if (!src.startsWith(STORAGE_PREFIX)) return src;
  const hit = signed.get(src.slice(STORAGE_PREFIX.length));
  return hit && hit.exp > Date.now() ? hit.url : null;
}

/** Deletes stored files (coaches only). Plain URLs and data URLs are ignored. Never throws. */
export async function deleteMedia(srcs: (string | undefined)[]) {
  const paths = srcs.filter((x): x is string => !!x && x.startsWith(STORAGE_PREFIX)).map((x) => x.slice(STORAGE_PREFIX.length));
  if (!paths.length) return;
  for (const p of paths) signed.delete(p);
  try {
    await db().storage.from('media').remove(paths);
  } catch {}
}

// ---------- Push notifications ----------

export const savePush = (teamId: string, sub: PushSubscriptionJSON, prefs: Record<string, unknown>) =>
  rpc<void>('save_push', {
    p_team: teamId,
    p_endpoint: sub.endpoint,
    p_p256dh: sub.keys?.p256dh,
    p_auth: sub.keys?.auth,
    p_prefs: prefs,
  });
export const deletePush = (endpoint: string) => rpc<void>('delete_push', { p_endpoint: endpoint });
