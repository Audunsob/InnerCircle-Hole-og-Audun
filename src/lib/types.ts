import type { Membership, TeamCoach, TeamLink } from './supabase';

export type Role = 'player' | 'sub' | 'coach';
export type Theme = 'light' | 'dark';
export type PostType = 'kamp' | 'trening' | 'beskjed';

export type Screen =
  | 'role'
  | 'playerKind'
  | 'login'
  | 'otp'
  | 'teamCode'
  | 'pickPlayer'
  | 'invite'
  | 'terms'
  | 'coachChoice'
  | 'coachCode'
  | 'createTeam'
  | 'pending'
  | 'pay'
  | 'pconsent'
  | 'cconsent'
  | 'app';

export type Tab = 'lag' | 'kamper' | 'arrangement' | 'okonomi' | 'min';

export interface Consent {
  photo: boolean;
  video: boolean;
  name: boolean;
  /** Older consents only: posts no longer tag players. */
  tag?: boolean;
  at: number;
  by?: 'self';
  adult?: boolean;
  playerSig?: string | null;
  /** Under 15: a parent's signature on the player's form. */
  parentSig?: string | null;
  /** Under 15: the name of the parent who signed. */
  parentName?: string | null;
  /** Older consents only: when a parent said yes from their own login. */
  parentAt?: number | null;
  /** Older consents only: the account of the parent who said yes. */
  parentBy?: string | null;
}

export interface Player {
  id: string;
  name: string;
  born: number | null;
  num: number;
  parent: { name: string; phone: string; email: string };
  consent: Consent | null;
  selfLogin: boolean;
  /** Who said no on the consent form, if anyone: the player, or the parent in the form's second part. */
  declined?: 'player' | 'parent' | null;
}

export interface Match {
  id: string;
  title?: string;
  opp: string;
  date: string; // yyyy-mm-dd
  time: string; // hh:mm
  meet?: string;
  venue: string;
  home: boolean;
  kind: 'Serie' | 'Cup';
  featured?: boolean;
  note?: string;
  us: number | null;
  them: number | null;
}

/**
 * Anything on the team's calendar that isn't a match: a pizza night, a players' meeting, a training.
 * Only coaches create, change or delete them.
 */
export interface TeamEvent {
  id: string;
  /** What kind of thing it is. The same as the title for events a coach made; "Trening" for trainings from a series. */
  kind: string;
  /** Material Symbols name shown next to it. */
  icon: string;
  title: string;
  date: string; // yyyy-mm-dd
  time: string; // hh:mm, start
  /** When it ends, hh:mm. */
  end?: string;
  venue: string;
  note?: string;
  /** Set on events that were made from a repeating plan, such as a fixed weekly training. */
  seriesId?: string | null;
}

/** A change to one training in a series: moved, or cancelled. Keyed by its date. */
export interface TrainingChange {
  cancelled?: boolean;
  time?: string;
  end?: string;
  venue?: string;
  note?: string;
}

/** A training that repeats every week (or every other week) on the same day. */
export interface TrainingSeries {
  id: string;
  title: string;
  /** 0 = Sunday … 6 = Saturday, like Date.getDay(). */
  weekday: number;
  /** 1 = every week, 2 = every other week. */
  every: 1 | 2;
  time: string; // hh:mm
  end: string; // hh:mm
  venue: string;
  note?: string;
  /** First training, yyyy-mm-dd. */
  from: string;
  /** Last day of the series, yyyy-mm-dd. Missing while it goes on. */
  until?: string | null;
  /** Single trainings that were moved or cancelled. */
  changes: Record<string, TrainingChange>;
}

export interface Media {
  id: string;
  kind: 'photo' | 'video';
  hue?: number;
  label?: string;
  dur?: string;
  src?: string;
}

export interface Post {
  id: string;
  type: PostType;
  authorId: string;
  author: string;
  authorRole: string;
  ts: number;
  matchId: string | null;
  /** The event (not a match) the post belongs to. */
  eventId?: string | null;
  media: Media[];
  text: string;
  /** Older posts only: players marked as in focus. New posts mark nobody; the consent list decides who may be in photos. */
  tagged: string[];
  likes: number;
  /** Device user ids that gave a heart. */
  likedBy: string[];
  edited?: boolean;
}

export interface Subscriber {
  id: string;
  name: string;
  rel: string;
  via: string | null;
  since: number;
  autoRenew?: boolean;
}

export interface Notif {
  id: string;
  text: string;
  ts: number;
  read: boolean;
  from?: 'coach';
}

export interface Payment {
  id: string;
  subId: string;
  name: string;
  at: number;
  amount: number;
  team: number;
}

/** Something a member sent to the coaches: a post they want looked at, or a question. */
export interface Report {
  id: string;
  /** Account id of the sender. Non-coaches only see and change their own. */
  by: string;
  name: string;
  /** Email to answer, filled in from the login. */
  contact: string;
  /** The post it is about; missing for a plain question. */
  postId?: string | null;
  text: string;
  at: number;
}

export interface CoachConsentRecord {
  id: string;
  name: string;
  contact: string;
  at: number;
  sig: string;
  mode: 'join' | 'create';
}

export interface TeamData {
  players: Player[];
  matches: Match[];
  /** Missing on teams made before events existed. */
  events?: TeamEvent[];
  /** Trainings that repeat every week. Missing on teams made before there were any. */
  trainings?: TrainingSeries[];
  posts: Post[];
  subs: Subscriber[];
  notifs: Notif[];
  account: { connected: boolean; bank: string; number: string };
  ytdBase: number;
  reminders: Record<string, number>;
  reports: Report[];
  teamName?: string;
  teamCode?: string;
  coachCode?: string;
  price?: number;
  payout?: { owner: string; acct: string; at: number };
  payments?: Payment[];
  coachConsents?: CoachConsentRecord[];
}

export interface Flow {
  role: Role | null;
  adult?: boolean;
  coachMode: 'join' | 'create' | null;
  coachName: string;
  contact: string;
  otp: string;
  teamCode: string;
  pickId: string | null;
  search: string;
  invite: string;
  inviteVia: string | null;
  terms: boolean;
  coachCode: string;
  /** Teams this account already coaches, found after login. They log in with the code, not sign up again. */
  coachTeams?: { id: string; name: string }[];
  teamName?: string;
  newCoachCode: string;
  newTeamCode: string;
  subName?: string;
  busy?: boolean;
  /** Team found from a code, before joining it. */
  peek?: { code: string; teamName: string; isCoachCode: boolean; players: { id: string; name: string; taken?: boolean }[] } | null;
  /** Joined as a player, waiting for a coach to approve it. */
  pendingTeam?: { id: string; name: string; role: 'player'; playerId: string; playerName: string } | null;
  err: string;
}

/** Signed consent form for players (under 15 with a second part for a parent), and the coach rules form. */
export interface SignedForm {
  step: number;
  adult?: boolean;
  coach?: boolean;
  mode?: 'join' | 'create';
  pending?: { n: string; cc: string; tc: string };
  p: 'yes' | 'no' | null;
  g?: 'yes' | 'no' | null;
  ps: string | null;
  gs?: string | null;
  /** The parent's name, in the second part for players under 15. */
  gn?: string;
  busy?: boolean;
  err: string;
}

export interface SubProfile {
  name?: string;
  viaId: string | null;
  active: boolean;
  cancelled: boolean;
  method: PayMethod;
  last4: string;
  startedAt: number | null;
  autoRenew?: boolean;
  notify: { posts: boolean; matches: boolean; results: boolean };
}

export interface Profiles {
  player: { playerId: string | null };
  sub: SubProfile;
  coach: { name?: string };
}

export type PayMethod = 'card' | 'apple' | 'google' | 'vipps';

export interface PayForm {
  autoRenew: boolean;
  method: PayMethod;
  num: string;
  exp: string;
  cvc: string;
  err: string;
  busy: boolean;
}

export type SheetName =
  | 'composer'
  | 'addMatch'
  | 'addEvent'
  | 'training'
  | 'trainingDay'
  | 'result'
  | 'postMenu'
  | 'confirm'
  | 'notifs'
  | 'price'
  | 'earnings'
  | 'payout'
  | 'subscribers'
  | 'method'
  | 'receipts'
  | 'consentView'
  | 'editPlayer'
  | 'switchTeam'
  | 'teamSettings'
  | 'report'
  | 'help'
  | 'deleteTeam'
  | 'homeScreen';

export interface Draft {
  id: string | null;
  type: PostType;
  matchId: string;
  eventId?: string;
  media: Media[];
  text: string;
  notify: boolean;
  loading?: boolean;
}

export interface Confirm {
  title: string;
  body: string;
  label: string;
  action: () => void;
  /** Just a message: one OK button and nothing to cancel. */
  info?: boolean;
}

/** Saved to localStorage. */
export type MemberRole = 'coach' | 'player' | 'sub';

export interface PersistedState {
  v: 3;
  /** The signed-in account's id, used for hearts and subscriptions. */
  uid: string;
  /** The team this device is showing, and which of your roles on it. */
  team: { id: string; role: MemberRole } | null;
  /** Push notifications are switched on for this device. */
  pushOn?: boolean;
  /** The tip about adding the app to the iPhone home screen has been shown on this device. */
  homeTip?: boolean;
  /** Last server version of the team document this device has seen. */
  version: number;
  /** Notifications newer than this are shown as unread. */
  seenNotifsAt: number;
  theme: Theme;
  screen: Screen;
  flow: Flow;
  pcons: SignedForm | null;
  pcCtx: 'app' | null;
  role: Role | null;
  onboarded: Partial<Record<Role, boolean>>;
  prof: Profiles;
  tab: Tab;
  filter: 'all' | PostType;
  kampTab: 'upcoming' | 'played';
  openMatch: string | null;
  notifyMatch: Record<string, boolean>;
  data: TeamData;
}

/** Kept in memory only. */
export interface EphemeralState {
  sheet: SheetName | null;
  /** The event open in the Annet tab. */
  openEvent: string | null;
  viewer: { postId: string; i: number } | null;
  toastMsg: string | null;
  draft: Draft | null;
  confirm: Confirm | null;
  form: Record<string, string | number | boolean | undefined>;
  pay: PayForm | null;
  payCtx: 'resub' | null;
  allPlayers: boolean;
  copied: boolean;
  menuPost: string | null;
  subView: 'all' | 'player';
  pf: { name: string; err: string };
  /** Coach: accounts linked to players, waiting or approved. Null until loaded. */
  links: TeamLink[] | null;
  /** Coach: all coaches on the team. Null until loaded. */
  coaches: TeamCoach[] | null;
  /** Coach: the player whose consent form is open. */
  consentPlayer: string | null;
  /** Every team and role this account has, for switching between them. Null until loaded. */
  teams: Membership[] | null;
}

export type AppState = PersistedState & EphemeralState;
