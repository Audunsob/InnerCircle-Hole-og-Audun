import { demoTeamData } from './demo';
import { addMonths } from './format';
import type { Membership, MemberRole, PendingJoin, TeamCoach, TeamLink, TeamPayload, TeamPeek } from './supabase';
import type { Comment, Player, Post, TeamData } from './types';

/**
 * A made-up database for the test mode on the moderator page (/moderator?test). It answers the same calls as the real
 * database functions in supabase/schema.sql, with the same rules for who may see and change what,
 * but lives only in this browser's localStorage. Nothing here ever reaches Supabase, no emails are
 * sent, and any login code works.
 */

/**
 * The version of supabase/schema.sql whose rules this copies. The build checks it against the schema
 * (scripts/check-test-mode.mjs): when the schema changes, bring the rules here up to date, then raise this.
 */
export const SCHEMA_VERSION = 12;

export interface SbUser {
  id: string;
  email: string;
  name: string;
  at: number;
}

export interface SbTeam {
  id: string;
  name: string;
  teamCode: string;
  coachCode: string;
  /** The team document without its name and codes, like the teams table. */
  data: TeamData;
  version: number;
  at: number;
}

export interface SbMember {
  teamId: string;
  userId: string;
  role: MemberRole;
  playerId: string | null;
  status: 'pending' | 'active';
  at: number;
}

export interface SandboxDb {
  v: 1;
  /** The account signed in on this device, if any. */
  session: string | null;
  users: SbUser[];
  teams: SbTeam[];
  members: SbMember[];
}

const DB_KEY = 'innercircle.test.db';
const DAY = 864e5;

let mem: SandboxDb | null = null;

export function sandboxDb(): SandboxDb {
  if (mem) return mem;
  try {
    const s = JSON.parse(localStorage.getItem(DB_KEY) || 'null');
    if (s?.v === 1) return (mem = s as SandboxDb);
  } catch {}
  return (mem = seed());
}

/** Saves after a change. If the browser's storage is full (many photos), the change stays until reload. */
function commit(db: SandboxDb) {
  mem = db;
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  } catch {}
}

/** Starts over with only the made-up team and its people. */
export function resetSandbox() {
  commit(seed());
}

export function setSandboxSession(userId: string | null) {
  const db = sandboxDb();
  commit({ ...db, session: userId });
}

const newId = (prefix: string) => prefix + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const norm = (c: unknown) => String(c ?? '').replace(/\s/g, '').toUpperCase();

export const sandboxSession = (): SbUser | null => {
  const db = sandboxDb();
  return db.users.find((u) => u.id === db.session) || null;
};

/** Logs in with any code: finds the account for the email, or makes one. */
export function sandboxSignIn(email: string): SbUser {
  const db = sandboxDb();
  const mail = email.trim().toLowerCase();
  let u = db.users.find((x) => x.email === mail);
  if (!u) {
    u = { id: newId('test'), email: mail, name: '', at: Date.now() };
    db.users = [...db.users, u];
  }
  commit({ ...db, session: u.id });
  return u;
}

// ---------- The made-up team ----------

export const TEST_TEAM_ID = 'test-fjellby';

/** Everyone in the made-up team has an account here, so you can log in as any of them. */
export const TEST_PEOPLE = {
  coach: 'test-kari',
  coach2: 'test-jonas',
  player: 'test-ola',
  pending: 'test-emma',
  sub: 'test-ingrid',
} as const;

function seed(): SandboxDb {
  const now = Date.now();
  const year = new Date().getFullYear();
  const consent = (adult: boolean) => ({
    photo: true,
    video: true,
    name: true,
    at: now - 30 * DAY,
    adult,
    playerSig: null,
    parentSig: null,
    parentName: adult ? null : 'Foresatt',
  });
  const player = (id: string, name: string, num: number, born: number, c: 'yes' | 'no' | null): Player => ({
    id,
    name,
    born,
    num,
    parent: { name: '', phone: '', email: '' },
    consent: c === 'yes' ? consent(year - born >= 15) : null,
    selfLogin: false,
    declined: c === 'no' ? 'parent' : null,
  });
  const players: Player[] = [
    player('tp-ola', 'Ola Fjell', 7, year - 16, 'yes'),
    player('tp-emma', 'Emma Lie', 4, year - 14, null),
    player('tp-noah', 'Noah Bakke', 9, year - 14, 'yes'),
    player('tp-sara', 'Sara Moen', 10, year - 15, 'yes'),
    player('tp-lucas', 'Lucas Dahl', 1, year - 14, 'yes'),
    player('tp-ida', 'Ida Strand', 6, year - 15, 'yes'),
    player('tp-filip', 'Filip Aas', 11, year - 13, 'no'),
    player('tp-nora', 'Nora Vik', 8, year - 14, 'yes'),
    player('tp-jakob', 'Jakob Lund', 5, year - 14, 'yes'),
    player('tp-maja', 'Maja Holm', 3, year - 13, null),
  ];
  const demo = demoTeamData();
  const posts: Post[] = [
    {
      id: 'tpost-ola',
      type: 'beskjed',
      authorId: TEST_PEOPLE.player,
      author: 'Ola Fjell',
      authorRole: 'Spiller',
      ts: now - 3 * 3600e3,
      matchId: null,
      media: [{ id: 'tm-ola', kind: 'photo', src: '/demo/ball.svg', label: 'Ny ball' }],
      text: 'Ny ball på trening i dag! Den spretter mye bedre enn den gamle.',
      tagged: [],
      likes: 0,
      likedBy: [],
      pending: true,
    },
    // The made-up coach's posts belong to the team's coaches here, so they can be changed and deleted.
    ...demo.posts.map((p) => ({ ...p, authorId: 'coach' })),
  ];
  const ingrid = 'sub-' + TEST_PEOPLE.sub;
  const data: TeamData = {
    ...demo,
    teamName: undefined,
    teamCode: undefined,
    players,
    posts,
    subs: [{ id: ingrid, name: 'Ingrid Hansen', rel: 'Bestemor', via: 'tp-ola', since: now - 40 * DAY, autoRenew: true }],
    payments: [
      { id: 'tpay1', subId: ingrid, name: 'Ingrid Hansen', at: now - 40 * DAY, amount: 29, team: 20.3 },
      { id: 'tpay2', subId: ingrid, name: 'Ingrid Hansen', at: now - 10 * DAY, amount: 29, team: 20.3 },
    ],
    coachConsents: [
      { id: 'tcc1', name: 'Kari Nordby', contact: 'kari@test.innercircle.no', at: now - 60 * DAY, sig: '', mode: 'create' },
      { id: 'tcc2', name: 'Jonas Berg', contact: 'jonas@test.innercircle.no', at: now - 50 * DAY, sig: '', mode: 'join' },
    ],
  };
  delete data.teamName;
  delete data.teamCode;
  const users: SbUser[] = [
    { id: TEST_PEOPLE.coach, email: 'kari@test.innercircle.no', name: 'Kari Nordby', at: now - 60 * DAY },
    { id: TEST_PEOPLE.coach2, email: 'jonas@test.innercircle.no', name: 'Jonas Berg', at: now - 50 * DAY },
    { id: TEST_PEOPLE.player, email: 'ola@test.innercircle.no', name: 'Ola Fjell', at: now - 30 * DAY },
    { id: TEST_PEOPLE.pending, email: 'emma@test.innercircle.no', name: 'Emma Lie', at: now - 2 * DAY },
    { id: TEST_PEOPLE.sub, email: 'ingrid@test.innercircle.no', name: 'Ingrid Hansen', at: now - 40 * DAY },
  ];
  const m = (userId: string, role: MemberRole, playerId: string | null, status: 'pending' | 'active', ago: number): SbMember => ({
    teamId: TEST_TEAM_ID,
    userId,
    role,
    playerId,
    status,
    at: now - ago * DAY,
  });
  return {
    v: 1,
    session: null,
    users,
    teams: [{ id: TEST_TEAM_ID, name: 'Fjellby IL G14', teamCode: 'FJELLBY14', coachCode: 'FJELLBY-ADMIN', data, version: 1, at: now - 60 * DAY }],
    members: [
      m(TEST_PEOPLE.coach, 'coach', null, 'active', 60),
      m(TEST_PEOPLE.coach2, 'coach', null, 'active', 50),
      m(TEST_PEOPLE.player, 'player', 'tp-ola', 'active', 30),
      m(TEST_PEOPLE.pending, 'player', 'tp-emma', 'pending', 2),
      m(TEST_PEOPLE.sub, 'sub', null, 'active', 40),
    ],
  };
}

// ---------- The rules, as in schema.sql ----------

/** A copy of `o` without the keys. */
function omit<T extends object, K extends keyof T>(o: T, ...keys: K[]): Omit<T, K> {
  const out = { ...o };
  for (const k of keys) delete out[k];
  return out;
}

const live = (x: { until?: number }) => typeof x.until !== 'number' || x.until > Date.now();
const subOk = (d: TeamData, uid: string) => d.subs.some((x) => x.id === 'sub-' + uid && live(x));

/** The first monthly anniversary of `since` that is still in the future. */
function until(since: number) {
  const s = Math.min(since || Date.now(), Date.now());
  let k = 1;
  while (addMonths(s, k) <= Date.now()) k++;
  return addMonths(s, k);
}

const publicPlayer = (p: Player): Player => {
  const c = p.consent;
  let consent = c;
  if (c) {
    consent = {
      ...omit(c, 'parentName', 'parentBy'),
      ...('playerSig' in c ? { playerSig: c.playerSig ? 'signed' : null } : {}),
      ...('parentSig' in c ? { parentSig: c.parentSig ? 'signed' : null } : {}),
      ...(c.parentBy ? { parentBy: 'signed' } : {}),
    };
  }
  return { ...p, born: null, parent: { name: '', phone: '', email: '' }, consent };
};

function payload(db: SandboxDb, t: SbTeam, role: MemberRole, uid: string): TeamPayload {
  const d = t.data;
  const own = ['sub-' + uid, 'par-' + uid];
  let data: TeamData;
  if (role === 'coach') {
    data = { ...d, teamName: t.name, teamCode: t.teamCode, coachCode: t.coachCode, subs: d.subs.filter(live) };
  } else if (role === 'sub' && !subOk(d, uid)) {
    data = {
      teamName: t.name,
      teamCode: t.teamCode,
      price: d.price,
      players: d.players.map((p) => ({ ...publicPlayer(p), consent: null, selfLogin: false })),
      matches: [],
      events: [],
      trainings: [],
      posts: [],
      subs: [],
      notifs: [],
      reports: [],
      reminders: {},
      account: { connected: false, bank: '', number: '' },
      ytdBase: 0,
      payments: (d.payments || []).filter((x) => x.subId === 'sub-' + uid),
    };
  } else {
    const mine = role === 'player' ? db.members.find((m) => m.teamId === t.id && m.userId === uid && m.role === 'player')?.playerId : null;
    data = {
      ...omit(d, 'payout', 'coachConsents'),
      teamName: t.name,
      teamCode: t.teamCode,
      players: d.players.map((p) => (p.id === mine ? p : publicPlayer(p))),
      posts: d.posts.filter((p) => !p.pending || p.authorId === uid),
      subs: d.subs.filter(live),
      payments: (d.payments || []).filter((x) => own.includes(x.subId)),
      reports: (d.reports || []).filter((x) => x.by === uid),
    };
  }
  return { teamId: t.id, role, version: t.version, data: structuredClone(data) };
}

const canPost = (d: TeamData, role: MemberRole, playerId: string | null) => {
  if (role !== 'player' || !playerId) return false;
  const p = d.players.find((x) => x.id === playerId);
  return !!p?.consent?.adult && (typeof p.born !== 'number' || new Date().getFullYear() - p.born >= 15);
};

/** What a non-coach may change, like save_team: their own hearts, comments, posts, consent, subscription, payments and reports. */
function mergeMember(prev: TeamData, next: TeamData, m: SbMember, uid: string): TeamData {
  const own = ['sub-' + uid, 'par-' + uid];
  const may = canPost(prev, m.role, m.playerId);
  const me = prev.players.find((p) => p.id === m.playerId);
  const author = me?.consent?.name ? me.name : 'Spiller';
  const commenter =
    m.role === 'sub' ? prev.subs.find((x) => x.id === 'sub-' + uid)?.name?.trim().slice(0, 60) || 'Abonnent' : may ? author : null;
  const commenterRole = m.role === 'sub' ? 'Abonnent' : 'Spiller';
  const comments = (old: Comment[] | undefined, nw: Comment[] | undefined) => {
    const kept = (old || []).filter((c) => c.authorId !== uid || (nw || []).some((x) => x.id === c.id));
    const added = commenter
      ? (nw || [])
          .filter((c) => c.authorId === uid && !(old || []).some((o) => o.id === c.id))
          .map((c) => ({ ...c, author: commenter, authorRole: commenterRole }))
      : [];
    return [...kept, ...added];
  };
  const posts: Post[] = [];
  if (may)
    for (const np of next.posts.filter((x) => !prev.posts.some((o) => o.id === x.id)).slice(0, 10))
      posts.push({ ...np, authorId: uid, author, authorRole: 'Spiller', ts: Date.now(), likes: 0, likedBy: [], pending: true });
  for (let op of prev.posts) {
    const np = next.posts.find((x) => x.id === op.id);
    if (op.authorId === uid) {
      if (!np) continue;
      if (may && (np.text !== op.text || JSON.stringify(np.media) !== JSON.stringify(op.media)))
        op = { ...op, text: np.text, media: np.media, matchId: np.matchId, eventId: np.eventId, type: np.type, edited: true, pending: true };
    }
    const likedBy = (op.likedBy || []).filter((x) => x !== uid).concat(np?.likedBy?.includes(uid) ? [uid] : []);
    posts.push({ ...op, likedBy, ...(np ? { comments: comments(op.comments, np.comments) } : {}) });
  }
  const players = prev.players.map((p) => {
    const np = next.players.find((x) => x.id === p.id);
    if (p.id !== m.playerId || !np) return p;
    return { ...p, consent: np.consent, declined: np.declined, selfLogin: np.selfLogin };
  });
  const subs = [
    ...prev.subs.filter((x) => !own.includes(x.id)),
    ...next.subs
      .filter((x) => own.includes(x.id))
      .map((x) => {
        if (x.autoRenew !== false) return omit(x, 'until');
        const old = prev.subs.find((o) => o.id === x.id && o.since === x.since && typeof o.until === 'number');
        return { ...x, until: old?.until ?? until(x.since) };
      }),
  ];
  const payments = [...(prev.payments || []).filter((x) => !own.includes(x.subId)), ...(next.payments || []).filter((x) => own.includes(x.subId))];
  const reports = [...(prev.reports || []).filter((x) => x.by !== uid), ...(next.reports || []).filter((x) => x.by === uid).slice(0, 20)];
  // The team's logo: players and paying subscribers may add or change it; only coaches remove it.
  const logo = (m.role !== 'sub' || subOk(prev, uid)) && okLogo(next.logo);
  return { ...prev, posts, players, subs, payments, reports, ...(logo ? { logo } : {}) };
}

/** Removes an account's hearts, comments and subscription from a team document. Payments stay. */
const forget = (d: TeamData, uid: string): TeamData => ({
  ...d,
  posts: d.posts.map((p) => ({ ...p, likedBy: (p.likedBy || []).filter((x) => x !== uid), ...(p.comments ? { comments: p.comments.filter((c) => c.authorId !== uid) } : {}) })),
  subs: d.subs.filter((x) => x.id !== 'sub-' + uid && x.id !== 'par-' + uid),
});

const stripNames = (d: TeamData): TeamData => omit(d, 'coachCode', 'teamCode', 'teamName');

/** Like ic_logo: the logo if it is a small picture, else nothing. */
const okLogo = (v: unknown) =>
  typeof v === 'string' && v.length <= 200000 && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(v) ? v : undefined;

/** Coaches may change everything, also remove the logo; something that isn't a small picture is never kept. */
const coachSave = (d: TeamData): TeamData => {
  const out = stripNames(d);
  return okLogo(out.logo) ? out : omit(out, 'logo');
};

// ---------- The calls ----------

/** Answers a database function call the way schema.sql would. Throws the same error codes. */
export function sandboxRpc(fn: string, a: Record<string, unknown>): unknown {
  const db = structuredClone(sandboxDb());
  const uid = () => {
    if (!db.session || !db.users.some((u) => u.id === db.session)) throw new Error('not_signed_in');
    return db.session;
  };
  const team = (id: unknown) => db.teams.find((t) => t.id === id) || null;
  const member = (teamId: unknown, role: unknown) =>
    db.members.find((m) => m.teamId === teamId && m.userId === uid() && m.role === role && m.status === 'active') || null;
  const needCoach = (teamId: unknown) => {
    if (!member(teamId, 'coach')) throw new Error('not_coach');
  };
  const email = (id: string) => db.users.find((u) => u.id === id)?.email ?? null;
  const lastCoach = (teamId: string, user: string) =>
    db.members.some((m) => m.teamId === teamId && m.userId === user && m.role === 'coach') &&
    !db.members.some((m) => m.teamId === teamId && m.userId !== user && m.role === 'coach' && m.status === 'active');
  const bump = (t: SbTeam) => {
    t.version += 1;
  };

  switch (fn) {
    case 'ic_is_moderator':
      return true;

    case 'peek_team': {
      uid();
      const c = norm(a.p_code);
      const t = db.teams.find((x) => x.coachCode === c || x.teamCode === c);
      if (!t) return null;
      return {
        teamId: t.id,
        teamName: t.name,
        isCoachCode: t.coachCode === c,
        players: t.data.players.map((p) => ({
          id: p.id,
          name: p.name,
          taken: db.members.some((m) => m.teamId === t.id && m.role === 'player' && m.playerId === p.id && m.userId !== uid()),
        })),
      } satisfies TeamPeek;
    }

    case 'join_team': {
      const me = uid();
      const c = norm(a.p_code);
      const role = a.p_role as MemberRole;
      if (!['coach', 'player', 'sub'].includes(role)) throw new Error('invalid_role');
      const t = db.teams.find((x) => (role === 'coach' ? x.coachCode === c : x.teamCode === c || x.coachCode === c));
      if (!t) return null;
      const playerId = role === 'player' ? String(a.p_player_id ?? '') : null;
      if (role === 'player' && !t.data.players.some((p) => p.id === playerId)) throw new Error('unknown_player');
      if (role === 'player' && db.members.some((x) => x.teamId === t.id && x.role === 'player' && x.playerId === playerId && x.userId !== me))
        throw new Error('player_taken');
      const old = db.members.find((x) => x.teamId === t.id && x.userId === me && x.role === role);
      const fresh = role === 'player' ? 'pending' : 'active';
      const m: SbMember = old
        ? { ...old, playerId, status: old.playerId === playerId ? old.status : fresh }
        : { teamId: t.id, userId: me, role, playerId, status: fresh, at: Date.now() };
      db.members = [...db.members.filter((x) => x !== old), m];
      commit(db);
      if (m.status === 'pending') return { pending: true, teamId: t.id, teamName: t.name, role } satisfies PendingJoin;
      return payload(db, t, role, me);
    }

    case 'create_team': {
      const me = uid();
      const cc = norm(a.p_coach_code);
      const tc = norm(a.p_team_code);
      if (cc.length < 4 || tc.length < 4 || cc === tc) throw new Error('invalid_codes');
      if (db.teams.some((t) => [cc, tc].includes(t.teamCode) || [cc, tc].includes(t.coachCode))) throw new Error('code_taken');
      const t: SbTeam = { id: newId('testlag'), name: String(a.p_name).trim(), teamCode: tc, coachCode: cc, data: stripNames(a.p_data as TeamData), version: 1, at: Date.now() };
      db.teams = [...db.teams, t];
      db.members = [...db.members, { teamId: t.id, userId: me, role: 'coach', playerId: null, status: 'active', at: Date.now() }];
      commit(db);
      return payload(db, t, 'coach', me);
    }

    case 'my_teams': {
      const me = uid();
      return db.members
        .filter((m) => m.userId === me && team(m.teamId))
        .sort((x, y) => y.at - x.at)
        .map((m) => ({ teamId: m.teamId, role: m.role, playerId: m.playerId, teamName: team(m.teamId)!.name, status: m.status }) satisfies Membership);
    }

    case 'get_team': {
      const t = team(a.p_team);
      if (!t || !member(a.p_team, a.p_role)) throw new Error('not_member');
      return payload(db, t, a.p_role as MemberRole, uid());
    }

    case 'team_version': {
      const me = uid();
      const t = team(a.p_team);
      return t && db.members.some((m) => m.teamId === t.id && m.userId === me && m.status === 'active') ? t.version : null;
    }

    case 'save_team': {
      const me = uid();
      const role = a.p_role as MemberRole;
      const m = member(a.p_team, role);
      const t = team(a.p_team);
      if (!m || !t) throw new Error('not_member');
      if (t.version !== a.p_version) return { ...payload(db, t, role, me), ok: false };
      const prev = t.data;
      const next = a.p_data as TeamData;
      const merged = role === 'coach' ? coachSave(next) : mergeMember(prev, next, m, me);
      // A player removed from the list takes the account linked to them along.
      if (role === 'coach')
        db.members = db.members.filter((x) => !(x.teamId === t.id && x.role === 'player' && x.playerId && !merged.players.some((p) => p.id === x.playerId)));
      // A subscriber taken off the list is no longer on the team.
      db.members = db.members.filter(
        (x) =>
          !(x.teamId === t.id && x.role === 'sub' && prev.subs.some((o) => o.id === 'sub-' + x.userId && live(o)) && !merged.subs.some((n) => n.id === 'sub-' + x.userId)),
      );
      t.data = merged;
      bump(t);
      commit(db);
      return { ...payload(db, t, role, me), ok: true };
    }

    case 'save_push':
    case 'delete_push':
      return null;

    case 'team_links': {
      needCoach(a.p_team);
      return db.members
        .filter((m) => m.teamId === a.p_team && m.role === 'player')
        .sort((x, y) => x.at - y.at)
        .map((m) => ({ userId: m.userId, role: 'player', playerId: m.playerId!, status: m.status, email: email(m.userId), at: new Date(m.at).toISOString() }) satisfies TeamLink);
    }

    case 'decide_link': {
      needCoach(a.p_team);
      const hit = (m: SbMember) => m.teamId === a.p_team && m.userId === a.p_user && m.role === a.p_role;
      db.members = a.p_approve ? db.members.map((m) => (hit(m) ? { ...m, status: 'active' } : m)) : db.members.filter((m) => !hit(m));
      commit(db);
      return null;
    }

    case 'team_coaches': {
      needCoach(a.p_team);
      const t = team(a.p_team)!;
      return db.members
        .filter((m) => m.teamId === t.id && m.role === 'coach' && m.status === 'active')
        .sort((x, y) => x.at - y.at)
        .map((m) => {
          const mail = email(m.userId);
          const c = (t.data.coachConsents || [])
            .filter((x) => mail && x.contact.toLowerCase() === mail)
            .sort((x, y) => y.at - x.at)[0];
          return { userId: m.userId, email: mail, at: new Date(m.at).toISOString(), me: m.userId === uid(), name: c?.name ?? null, signedAt: c?.at ?? null } satisfies TeamCoach;
        });
    }

    case 'update_team': {
      needCoach(a.p_team);
      const t = team(a.p_team)!;
      const n = String(a.p_name ?? '').replace(/\s+/g, ' ').trim();
      const tc = norm(a.p_team_code);
      const cc = norm(a.p_coach_code);
      if (n.length < 2 || cc.length < 4 || tc.length < 4 || cc === tc) throw new Error('invalid_codes');
      if (db.teams.some((x) => x.id !== t.id && ([cc, tc].includes(x.teamCode) || [cc, tc].includes(x.coachCode)))) throw new Error('code_taken');
      Object.assign(t, { name: n, teamCode: tc, coachCode: cc });
      bump(t);
      commit(db);
      return { ...payload(db, t, 'coach', uid()), ok: true };
    }

    case 'leave_team': {
      const me = uid();
      const hit = (m: SbMember) => m.teamId === a.p_team && m.userId === me && m.role === a.p_role;
      if (!db.members.some(hit)) throw new Error('not_member');
      if (a.p_role === 'coach' && lastCoach(String(a.p_team), me)) throw new Error('last_coach');
      db.members = db.members.filter((m) => !hit(m));
      const t = team(a.p_team);
      if (t && !db.members.some((m) => m.teamId === t.id && m.userId === me)) {
        t.data = forget(t.data, me);
        bump(t);
      }
      commit(db);
      return null;
    }

    case 'delete_me': {
      const me = uid();
      const lone = db.members.find((m) => m.userId === me && m.role === 'coach' && lastCoach(m.teamId, me));
      if (lone) throw new Error('last_coach:' + (team(lone.teamId)?.name || ''));
      for (const t of db.teams)
        if (db.members.some((m) => m.teamId === t.id && m.userId === me)) {
          t.data = forget(t.data, me);
          bump(t);
        }
      db.members = db.members.filter((m) => m.userId !== me);
      db.users = db.users.filter((u) => u.id !== me);
      db.session = null;
      commit(db);
      return null;
    }

    case 'remove_coach': {
      needCoach(a.p_team);
      if (a.p_user === uid()) throw new Error('use_leave');
      db.members = db.members.filter((m) => !(m.teamId === a.p_team && m.userId === a.p_user && m.role === 'coach'));
      commit(db);
      return null;
    }

    case 'delete_team': {
      needCoach(a.p_team);
      const t = team(a.p_team)!;
      if (String(a.p_confirm ?? '').trim().toLowerCase() !== t.name.trim().toLowerCase()) throw new Error('wrong_name');
      db.teams = db.teams.filter((x) => x.id !== t.id);
      db.members = db.members.filter((m) => m.teamId !== t.id);
      commit(db);
      return null;
    }

    default:
      // The moderator's own pages (overview, "se som") aren't part of the test mode.
      throw new Error('not_in_test_mode:' + fn);
  }
}

/** A photo, video or signature in the test mode: kept in the browser instead of the storage bucket. */
export async function sandboxUpload(src: string | Blob): Promise<string> {
  if (typeof src === 'string') return src;
  // Videos are too big for localStorage; they play until the page is reloaded.
  if (src.type.startsWith('video/')) return URL.createObjectURL(src);
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(src);
  });
}
