import type {
  ConsentKey,
  EphemeralState,
  Flow,
  ParentConsentDraft,
  PayForm,
  PersistedState,
  PostType,
  Role,
  TeamData,
} from './types';

export const LS_KEY = 'innercircle.v3';
export const DEFAULT_TEAM = 'Laget';
export const COACH = 'Trener';
export const DEFAULT_PRICE = 20;

export const TYPES: Record<PostType, { label: string }> = {
  kamp: { label: 'Kamp' },
  trening: { label: 'Trening' },
  beskjed: { label: 'Beskjed' },
};
export const ROLES: Record<Role, string> = { player: 'Spiller', parent: 'Foresatt', sub: 'Abonnent', coach: 'Trener' };
export const CKEYS: [ConsentKey, string, string][] = [
  ['photo', 'Bilder', 'Bilder fra kamper og treninger'],
  ['video', 'Videoklipp', 'Korte klipp fra kamp og trening'],
  ['name', 'Fornavn i tekst', 'Fornavnet kan stå i teksten til et innlegg'],
  ['tag', 'Merking i innlegg', 'Treneren kan merke barnet, så dere finner bildene'],
];

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

export const defCons = (): ParentConsentDraft => ({
  step: 1,
  draft: { photo: false, video: false, name: false, tag: false },
  check: false,
});

export const newPay = (): PayForm => ({ autoRenew: true, method: 'card', num: '', exp: '', cvc: '', err: '', busy: false });

export function freshState(): PersistedState {
  let dark = false;
  try {
    dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {}
  return {
    v: 3,
    uid: newId(),
    team: null,
    version: 0,
    seenNotifsAt: 0,
    theme: dark ? 'dark' : 'light',
    screen: 'role',
    flow: blankFlow(),
    cons: null,
    consCtx: null,
    pcons: null,
    pcCtx: null,
    role: null,
    onboarded: {},
    prof: {
      player: { playerId: null },
      parent: { childId: null, subscribed: false },
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
});
