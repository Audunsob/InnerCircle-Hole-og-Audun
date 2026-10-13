import type {
  EphemeralState,
  Flow,
  PayForm,
  PersistedState,
  PostType,
  Role,
  TeamData,
} from './types';

export const LS_KEY = 'innercircle.v3';
export const DEFAULT_TEAM = 'Laget';
export const COACH = 'Administrator';
export const DEFAULT_PRICE = 20;

export const TYPES: Record<PostType, { label: string }> = {
  kamp: { label: 'Kamp' },
  trening: { label: 'Trening' },
  beskjed: { label: 'Beskjed' },
};
/** Icons a coach can pick for an event. */
export const EVENT_ICONS = ['event', 'groups', 'restaurant', 'local_pizza', 'celebration', 'forum', 'directions_run', 'directions_bus', 'emoji_events', 'volunteer_activism', 'school', 'sports_soccer'];

export const ROLES: Record<Role, string> = { player: 'Spiller', sub: 'Abonnent', coach: 'Administrator' };

/** A new team with nothing in it yet. */
export const emptyTeam = (): TeamData => ({
  players: [],
  matches: [],
  posts: [],
  subs: [],
  notifs: [],
  payments: [],
  account: { connected: false, bank: '', number: '' },
  ytdBase: 0,
  reminders: {},
  reports: [],
});

const newId = () => {
  try {
    return crypto.randomUUID();
  } catch {
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
  }
};

export const blankFlow = (): Flow => ({
  coachName: '',
  coachMode: null,
  newCoachCode: '',
  newTeamCode: '',
  role: null,
  contact: '',
  otp: '',
  teamCode: '',
  pickId: null,
  search: '',
  invite: '',
  inviteVia: null,
  terms: false,
  coachCode: '',
  err: '',
});

export const newPay = (): PayForm => ({ autoRenew: true, method: 'card', num: '', exp: '', cvc: '', err: '', busy: false });

export function freshState(): PersistedState {
  return {
    v: 3,
    uid: newId(),
    team: null,
    version: 0,
    seenNotifsAt: 0,
    // Light like the iPhone's own apps; dark mode is a choice on Min side.
    theme: 'light',
    screen: 'role',
    flow: blankFlow(),
    pcons: null,
    pcCtx: null,
    role: null,
    onboarded: {},
    prof: {
      player: { playerId: null },
      sub: {
        viaId: null,
        active: false,
        cancelled: false,
        method: 'card',
        last4: '4242',
        startedAt: null,
        notify: { posts: true, matches: true, results: true },
      },
      coach: {},
    },
    tab: 'lag',
    filter: 'all',
    kampTab: 'upcoming',
    openMatch: null,
    notifyMatch: {},
    data: emptyTeam(),
  };
}

export const ephemeral = (): EphemeralState => ({
  sheet: null,
  openEvent: null,
  viewer: null,
  toastMsg: null,
  draft: null,
  confirm: null,
  form: {},
  pay: null,
  payCtx: null,
  allPlayers: false,
  copied: false,
  menuPost: null,
  subView: 'all',
  pf: { name: '', err: '' },
  links: null,
  coaches: null,
  consentPlayer: null,
  teams: null,
});
