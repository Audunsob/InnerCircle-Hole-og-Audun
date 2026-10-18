import { create } from 'zustand';
import {
  ascii,
  copyText,
  DAY,
  download,
  firstName,
  fmtAcct,
  fmtDate,
  fmtDay,
  isEmail,
  iso,
  isPlayed,
  matchTime,
  nextChargeText,
  NB,
  resizeImage,
  validAcct,
} from './format';
import {
  blankFlow,
  COACH,
  emptyTeam,
  ephemeral,
  freshState,
  LS_KEY,
  newPay,
} from './seed';
import {
  accessToken,
  CodeTakenError,
  createTeam,
  currentSession,
  decideLink,
  deleteMe,
  deleteMedia,
  deleteTeam,
  deleteTeamFiles,
  removeCoach,
  getTeam,
  joinTeam,
  LastCoachError,
  leaveTeam,
  myTeams,
  peekTeam,
  PlayerTakenError,
  saveTeam,
  sendCode,
  signOut,
  teamCoaches,
  teamLinks,
  teamVersion,
  updateTeam,
  uploadMedia,
  verifyCode,
  type Membership,
  type TeamPayload,
} from './supabase';
import { scoreTitle } from './derive';
import { disablePush, enablePush, isStandalone, needsHomeScreen, phoneKind, updatePushPrefs, type PushPrefs } from './push';
import { canComment, canPost, coachName, matchTitle, memberAuthor, price, shortTeam, teamName } from './selectors';

const MAX_VIDEO = 50 * 1024 * 1024;

const VIDEO_EXT: Record<string, string> = { mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm' };

/**
 * Some phones hand over videos without a file type, or as .m4v. Give them the type
 * the storage bucket accepts, judged from the file name. Anything else is left as is.
 */
function withVideoType(f: File): File {
  const ext = f.name.split('.').pop()?.toLowerCase() || '';
  const type = (!f.type || f.type === 'video/x-m4v') && VIDEO_EXT[ext];
  return type ? new File([f], f.name, { type }) : f;
}

/** "Ny video", "Nytt bilde", "3 bilder og 1 video" — for push notifications without text. */
function mediaText(media: Media[]) {
  const v = media.filter((m) => m.kind === 'video').length;
  const p = media.length - v;
  if (!v) return p === 1 ? 'Nytt bilde' : 'Nye bilder';
  if (!p) return v === 1 ? 'Ny video' : 'Nye videoer';
  return p + (p === 1 ? ' bilde' : ' bilder') + ' og ' + v + (v === 1 ? ' video' : ' videoer');
}

/** Length of a video file as m:ss, read from its metadata. */
function videoDuration(file: File): Promise<string> {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    const url = URL.createObjectURL(file);
    const done = (txt: string) => {
      URL.revokeObjectURL(url);
      resolve(txt);
    };
    v.preload = 'metadata';
    v.onloadedmetadata = () => {
      const t = Math.round(v.duration || 0);
      done(Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'));
    };
    v.onerror = () => done('');
    v.src = url;
  });
}
import type {
  AppState,
  Comment,
  Draft,
  EphemeralState,
  Flow,
  Match,
  Media,
  MemberRole,
  Notif,
  PayForm,
  PayMethod,
  PersistedState,
  Player,
  Post,
  Profiles,
  Role,
  Screen,
  SheetName,
  SignedForm,
  Tab,
  TeamData,
  TrainingSeries,
  TeamEvent,
} from './types';
import { findEvent, firstOn, isRunning, isTraining, repeatText, seriesIcs, timeText, WEEKDAYS, yesterday } from './trainings';

const EPHEMERAL_KEYS = Object.keys(ephemeral()) as (keyof EphemeralState)[];

function loadState(): AppState {
  let s: PersistedState | null = null;
  try {
    s = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
  } catch {}
  if (!s || s.v !== 3) s = freshState();
  // The parent role is gone: a device that was signed in as a parent starts over (still signed in).
  if ((s.role as string) === 'parent' || (s.team?.role as string) === 'parent' || (s.screen as string) === 'consent')
    s = { ...freshState(), uid: s.uid, theme: s.theme, homeTip: s.homeTip, pushOn: s.pushOn };
  if (!['all', 'kamp', 'trening', 'beskjed'].includes(s.filter)) s = { ...s, filter: 'all' };
  return { ...s, ...ephemeral() };
}

export interface Actions {
  /** Fetches the team from the server if it changed. */
  refresh: () => Promise<void>;
  /** Opens the subscriber sign-up with a team code from an invite link. */
  startInvite: (code: string, via: string | null) => void;
  toast: (msg: string) => void;
  toggleTheme: () => void;
  go: (screen: Screen) => void;
  setFlow: (p: Partial<Flow>) => void;
  setData: (fn: (d: TeamData) => TeamData) => void;
  setForm: (p: AppState['form']) => void;
  setProf: <R extends keyof Profiles>(r: R, patch: Partial<Profiles[R]>) => void;
  updPlayer: (id: string, patch: Partial<Player>) => void;

  // Onboarding
  chooseRole: (r: Role) => void;
  choosePlayerKind: (adult: boolean) => void;
  chooseCoachMode: (mode: 'join' | 'create') => void;
  /** From the coach code screen: create another team instead of logging in to the one this account has. */
  createAnotherTeam: () => void;
  flowSubmit: () => void;
  setOtp: (v: string) => void;
  suggestCodes: () => void;
  back: () => void;
  enterApp: (r: Role) => void;
  logout: () => void;
  /** Leaves the current team (after asking) and goes back to the start screen. */
  leaveTeam: () => void;
  /** Deletes the account everywhere (after asking) and signs out. */
  deleteAccount: () => void;
  /** Back to the start screen without signing out. */
  /** Signed in from somewhere other than the code box, e.g. the link in the email. */
  linkSignedIn: (id: string, email: string) => void;
  /** After the email link signed this browser in: continue where it makes sense. */
  resumeAfterLink: (email: string) => Promise<void>;
  resendCode: () => Promise<void>;
  /** Waiting for a coach: checks whether the request was approved (or turned down). */
  checkPending: (manual?: boolean) => Promise<void>;

  // Signed forms (player and coach)
  setPC: (p: Partial<SignedForm>) => void;
  pcNext: () => void;
  pcBack: () => void;
  openPlayerConsent: () => void;
  ccNext: () => void;
  ccBack: () => void;

  // Payment
  setPay: (p: Partial<PayForm>) => void;
  openPay: (ctx: 'resub') => void;
  payBack: () => void;
  setCard: (field: 'num' | 'exp' | 'cvc', raw: string) => void;
  paySubmit: () => void;
  setPayMethod: (m: PayMethod) => void;

  // App
  setTab: (t: Tab) => void;
  setFilter: (f: AppState['filter']) => void;
  setKampTab: (t: AppState['kampTab']) => void;
  openMatchView: (id: string) => void;
  closeMatch: () => void;
  goKamper: () => void;
  toggleLike: (id: string) => void;
  /** Coaches: who gave a post a heart. */
  openLikes: (id: string) => void;
  addComment: (postId: string, text: string) => boolean;
  deleteComment: (postId: string, commentId: string) => void;
  openViewer: (postId: string, i: number) => void;
  closeViewer: () => void;
  stepViewer: (dir: number) => void;
  openSheet: (sheet: SheetName) => void;
  closeSheet: () => void;
  ask: (title: string, body: string, label: string, action: () => void) => void;
  doConfirm: () => void;
  toggleNotifyMatch: (id: string) => void;
  addToCal: (m: Match) => void;
  showMap: (m: { venue: string }) => void;
  openEventView: (id: string) => void;
  closeEvent: () => void;
  addEventToCal: (e: TeamEvent) => void;

  // Coach
  /** Opens the match form, empty or with an existing match to change. */
  openAddMatch: (id?: string) => void;
  saveMatch: () => void;
  deleteMatch: (id: string) => void;
  /** Opens the event form, empty or with an existing event to change. */
  openAddEvent: (id?: string) => void;
  saveEvent: () => void;
  deleteEvent: (id: string) => void;
  /** Opens the form for a training that repeats, empty or with an existing series. */
  openTraining: (id?: string) => void;
  saveTraining: () => void;
  /** Stops a series after today; the trainings already held stay. */
  endTraining: (id: string) => void;
  /** Opens one training in a series, to move or cancel just that day. */
  openTrainingDay: (seriesId: string, date: string) => void;
  saveTrainingDay: () => void;
  /** Cancels one training, or brings a cancelled one back. */
  cancelTrainingDay: (cancel: boolean) => void;
  trainingToCal: (id: string) => void;
  openResult: (id: string) => void;
  stepResult: (k: 'us' | 'them', dir: number) => void;
  saveResult: () => void;
  /** Opens the composer for a new post (optionally about an event), or to edit a post. */
  openComposer: (postId: string | null, eventId?: string) => void;
  setDraft: (p: Partial<Draft>) => void;
  addFiles: (files: File[]) => Promise<void>;
  removeMedia: (id: string) => void;
  publish: () => void;
  deletePost: (id: string) => void;
  copyCode: (code: string, label: string) => void;
  openTeamSettings: () => void;
  /** New random code in the team settings form. */
  newCode: (which: 'teamCode' | 'coachCode') => void;
  saveTeamSettings: () => Promise<void>;
  /** Coach: reminds the players who haven't answered the consent form (or lack a parent's signature). */
  remindConsent: (ids: string[]) => void;
  /** Coach: marks a report or question as handled. */
  dismissReport: (id: string) => void;
  openPrice: () => void;
  stepPrice: (dir: number) => void;
  savePrice: () => void;
  openPayout: () => void;
  savePayout: () => void;
  removeSub: (id: string) => void;
  addPlayer: () => void;
  openEditPlayer: (id: string) => void;
  savePlayer: () => void;
  removePlayer: (id: string) => void;
  /** Coach: loads the accounts linked to players, and the other coaches. */
  loadLinks: () => Promise<void>;
  /** Loads every team and role this account has (for «Dine lag» under Min side). */
  loadTeams: () => Promise<void>;
  /** Shows another of this account's teams or roles. A coach role asks for the coach code first. */
  switchTeam: (teamId: string, role: MemberRole) => void;
  /** From the switchTeam sheet: checks the coach code and switches. */
  submitSwitchCode: () => Promise<void>;
  /** Coach: removes another coach from the team (after asking). */
  removeCoach: (userId: string) => void;
  /** Coach: deletes the team for everyone, after typing its name in the deleteTeam sheet. */
  deleteTeam: () => Promise<void>;
  /** Coach: approves a waiting player, or removes the link. */
  decide: (userId: string, role: 'player', approve: boolean) => void;

  // Subscriber / family
  cancelSub: () => void;
  copyInvite: (link: string) => void;
  shareInvite: (link: string) => void;

  // Everyone
  /** Report a post to the coaches, or (without a post) ask them something. */
  openReport: (postId: string | null) => void;
  sendReport: () => Promise<void>;
}

export type Store = AppState & Actions;

let toastTimer: ReturnType<typeof setTimeout> | undefined;
let copiedTimer: ReturnType<typeof setTimeout> | undefined;
let otpTimer: ReturnType<typeof setTimeout> | undefined;

const scrollTop = () => {
  try {
    window.scrollTo(0, 0);
  } catch {}
};

export const useStore = create<Store>()((set, get) => {
  const s = () => get();
  const setFlow = (p: Partial<Flow>) => set((st) => ({ flow: { ...st.flow, ...p } }));

  // ---------- Sync with the shared team document ----------
  // Local changes are kept as a queue of functions. Each save sends the server's last
  // document with the queue applied. If someone else saved first, the queue is replayed
  // on top of their version, so no one's change is lost.
  let pending: ((d: TeamData) => TeamData)[] = [];
  let server: TeamData | null = null;
  let saving = false;
  let failedOnce = false;
  const replay = (base: TeamData) =>
    pending.reduce((d, fn) => {
      try {
        return fn(d);
      } catch {
        return d;
      }
    }, base);
  const applyServer = (p: TeamPayload) => {
    server = p.data;
    set({ version: p.version, data: replay(p.data) });
  };
  /** The session ended or this account was removed from the team: back to the start screen. */
  const signedOutError = (e: unknown) => {
    const msg = e instanceof Error ? e.message : '';
    if (/not_member/.test(msg)) {
      removedFromTeam();
      return true;
    }
    if (!/not_signed_in|JWT|jwt/.test(msg)) return false;
    pending = [];
    server = null;
    set({ team: null, role: null, screen: 'role', sheet: null });
    toast('Logg inn igjen for å fortsette.');
    return true;
  };
  /** The coach removed this account, or the player it was linked to, from the team. */
  const removedFromTeam = () => {
    pending = [];
    server = null;
    set({ team: null, role: null, screen: 'role', flow: blankFlow() });
    inform(
      'Du er ikke lenger på laget',
      'Administratoren har fjernet deg fra laget eller koblet kontoen din fra. Snakk med administratoren hvis det er feil.',
    );
  };
  /** Takes a subscriber who isn't on the team's list (never finished paying, or the subscription ran out) to the terms and payment. */
  const payAgain = (p: TeamPayload) => {
    setFlow({ ...blankFlow(), role: 'sub', peek: { code: p.data.teamCode || '', teamName: p.data.teamName || '', isCoachCode: false, players: p.data.players }, terms: false });
    set({ role: null });
    go('terms');
  };
  /** The subscription ran out while the app was open: the server no longer sends the team. Not while
   * changes wait to be saved, since a payment that isn't saved yet isn't on the server's list. */
  const checkSubEnded = (p: TeamPayload) => {
    const st = s();
    if (pending.length || st.team?.role !== 'sub' || st.screen !== 'app' || p.data.subs.some((x) => x.id === mySubId())) return;
    setProf('sub', { active: false, cancelled: false });
    payAgain(p);
    inform('Abonnementet er over', 'Start det igjen for å se bildene fra laget.');
  };
  const flush = async (): Promise<void> => {
    const team = s().team;
    if (saving || !pending.length || !team || !server) return;
    saving = true;
    try {
      for (let attempt = 0; attempt < 5 && pending.length; attempt++) {
        const batch = pending.length;
        const res = await saveTeam(team.id, team.role, s().version, replay(server));
        if (res.ok) pending = pending.slice(batch);
        applyServer(res);
        checkSubEnded(res);
        if (res.ok) break;
      }
      failedOnce = false;
    } catch (e) {
      saving = false;
      if (signedOutError(e)) return;
      if (!failedOnce) toast('Fikk ikke lagret. Prøver igjen …');
      failedOnce = true;
      setTimeout(() => void flush(), 4000);
      return;
    } finally {
      saving = false;
    }
    if (pending.length) void flush();
  };
  const setData = (fn: (d: TeamData) => TeamData) => {
    set((st) => ({ data: fn(st.data) }));
    if (!s().team) return;
    pending.push(fn);
    if (server) void flush();
    else void refresh();
  };
  /** Shows a team this account has joined. */
  const connect = (p: TeamPayload) => {
    pending = [];
    set({ team: { id: p.teamId, role: p.role } });
    applyServer(p);
  };
  let linksAt = 0;
  const refresh = async () => {
    if (s().screen === 'pending') return void checkPending();
    const team = s().team;
    if (!team || saving) return;
    if (team.role === 'coach' && s().screen === 'app' && Date.now() - linksAt > 30000) void loadLinks();
    // With unsaved changes, only fetch if we have never loaded the server copy (e.g. right after a reload).
    if (server && pending.length) return;
    try {
      if (server && (await teamVersion(team.id)) === s().version) return;
      const p = await getTeam(team.id, team.role);
      if (!server || !pending.length) applyServer(p);
      if (pending.length) void flush();
      checkSubEnded(p);
      // Removed from the list by a coach whose app didn't also unlink the account.
      const mine = team.role === 'player' ? s().prof.player.playerId : null;
      if (mine && s().screen === 'app' && !p.data.players.some((x) => x.id === mine)) removedFromTeam();
    } catch (e) {
      signedOutError(e);
    }
  };
  const netError = 'Fikk ikke kontakt. Sjekk nettet og prøv igjen.';
  /** What went wrong talking to the server, in words the person can act on. */
  const errorText = (e: unknown) => {
    const msg = e instanceof Error ? e.message : String(e);
    if (/fetch|network|load failed|timeout/i.test(msg)) return netError;
    if (/not_signed_in|JWT|jwt/.test(msg)) return 'Du er logget ut. Gå tilbake og logg inn på nytt.';
    if (/not_member/.test(msg)) return 'Du er ikke lenger på laget. Snakk med administratoren.';
    return 'Noe gikk galt. Prøv igjen, eller snakk med administratoren hvis det skjer igjen.';
  };
  /** Why a login email couldn't be sent, in words the person can act on. */
  const sendError = (e: unknown) => {
    const msg = e instanceof Error ? e.message : '';
    if (/rate|seconds|many/i.test(msg)) return 'Du har bedt om mange koder. Vent litt og prøv igjen.';
    if (/email|mail|smtp/i.test(msg)) return 'Vi fikk ikke sendt e-posten akkurat nå. Prøv igjen om litt, eller kontakt administratoren.';
    return netError;
  };

  /** Tells the team's phones about something new. Only coaches can; it does nothing for others. */
  const notify = async (
    kind: 'posts' | 'matches' | 'results' | 'reminders',
    title: string,
    body: string,
    extra: { matchId?: string | null; onlyWatchers?: boolean; playerIds?: string[] } = {},
  ) => {
    const team = s().team;
    if (!team || team.role !== 'coach') return;
    try {
      const token = await accessToken();
      await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ teamId: team.id, kind, title, body, ...extra }),
      });
    } catch {}
  };

  /** Adds a line to the team's list of notifications (the bell). */
  const addNotif = (text: string, team = false) => {
    const now = Date.now();
    const n: Notif = { id: 'n' + now, text, ts: now, read: false, from: 'coach', ...(team ? { team } : {}) };
    setData((d) => ({ ...d, notifs: [n, ...d.notifs].slice(0, 100) }));
  };

  /** Saves the change to one training in a series; an empty change removes it. */
  const putChange = (seriesId: string, date: string, c: TrainingSeries['changes'][string]) =>
    setData((d) => ({
      ...d,
      trainings: (d.trainings || []).map((x) => {
        if (x.id !== seriesId) return x;
        const changes = { ...x.changes };
        if (Object.keys(c).length) changes[date] = c;
        else delete changes[date];
        return { ...x, changes };
      }),
    }));

  const setForm = (p: AppState['form']) => set((st) => ({ form: { ...st.form, ...p } }));
  const setProf = <R extends keyof Profiles>(r: R, patch: Partial<Profiles[R]>) =>
    set((st) => ({ prof: { ...st.prof, [r]: { ...st.prof[r], ...patch } } }));
  const updPlayer = (id: string, patch: Partial<Player>) =>
    setData((d) => ({ ...d, players: d.players.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));
  const toast = (msg: string) => {
    set({ toastMsg: msg });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => set({ toastMsg: null }), 2600);
  };
  const go = (screen: Screen) => {
    set({ screen });
    scrollTop();
  };
  const ask = (title: string, body: string, label: string, action: () => void) =>
    set({ sheet: 'confirm', confirm: { title, body, label, action } });
  /** A message with only an OK button. */
  const inform = (title: string, body: string) =>
    set({ sheet: 'confirm', confirm: { title, body, label: 'OK', action: () => {}, info: true } });
  /** An empty player consent form. Under 15 it has a second part for a parent. */
  const newPlayerForm = (adult: boolean): SignedForm => ({ step: 1, adult, p: null, g: null, ps: null, gs: null, gn: '', err: '' });
  const setPC = (p: Partial<SignedForm>) =>
    set((st) => ({ pcons: { ...(st.pcons || { step: 1, p: null, ps: null, err: '' }), ...p, err: p.err || '' } }));
  const setPay = (p: Partial<PayForm>) => set((st) => ({ pay: { ...(st.pay || newPay()), ...p } }));

  /** Files among these that no post uses (uploaded for a draft that wasn't published). */
  const unpublished = (media: Media[]) => {
    const used = new Set(s().data.posts.flatMap((p) => p.media.map((m) => m.src)));
    return media.map((m) => m.src).filter((src) => !used.has(src));
  };

  /** Back to the start screen with nothing from the team left in memory. Does not sign out. */
  const resetToStart = () => {
    pending = [];
    server = null;
    set({
      role: null,
      team: null,
      onboarded: {},
      data: emptyTeam(),
      version: 0,
      screen: 'role',
      flow: blankFlow(),
      sheet: null,
      payCtx: null,
      pay: null,
      tab: 'lag',
      openMatch: null,
      openEvent: null,
      links: null,
      coaches: null,
    });
    scrollTop();
  };

  const enterApp = (r: Role) => {
    set((st) => ({
      role: r,
      screen: 'app',
      tab: 'lag',
      filter: 'all',
      openMatch: null,
      openEvent: null,
      sheet: null,
      payCtx: null,
      pay: null,
      onboarded: { ...st.onboarded, [r]: true },
    }));
    scrollTop();
    // Everyone on a phone gets the home screen guide once, the first time in. iPhone only gives
    // notifications to apps on the home screen.
    if (!s().homeTip && phoneKind() && !isStandalone()) set({ homeTip: true, sheet: 'homeScreen' });
  };

  // ---------- Onboarding steps ----------

  const submitLogin = async () => {
    const email = s().flow.contact.trim().toLowerCase();
    if (!isEmail(email)) return setFlow({ err: 'Skriv inn en gyldig e-postadresse.' });
    setFlow({ contact: email, busy: true, err: '', otp: '' });
    // Already signed in with this email on this device: no need for a new code.
    const session = await currentSession();
    if (session && session.email === email) {
      setFlow({ busy: false });
      set({ uid: session.id });
      return afterLogin();
    }
    try {
      await sendCode(email);
    } catch (e) {
      return setFlow({ busy: false, err: sendError(e) });
    }
    setFlow({ busy: false });
    go('otp');
    toast('Vi har sendt en kode til ' + email);
  };

  const resendCode = async () => {
    try {
      await sendCode(s().flow.contact);
      toast('Ny kode er sendt');
    } catch (e) {
      toast(sendError(e));
    }
  };

  const afterOtp = async () => {
    const st = s();
    if (st.screen !== 'otp' || !st.flow.role || st.flow.busy) return;
    if (st.flow.otp.length !== 6) return setFlow({ err: 'Koden har 6 sifre.' });
    setFlow({ busy: true, err: '' });
    try {
      const uid = await verifyCode(st.flow.contact, st.flow.otp);
      set({ uid });
    } catch {
      // The code and the link in the email share one token. If the link was opened in this
      // browser (another tab), we are already signed in, so carry on.
      const session = await currentSession();
      if (session && session.email === st.flow.contact) {
        set({ uid: session.id });
        setFlow({ busy: false });
        return afterLogin();
      }
      return setFlow({
        busy: false,
        otp: '',
        err: 'Koden stemmer ikke eller er utløpt. Bare den nyeste koden gjelder. Prøv igjen eller be om en ny.',
      });
    }
    setFlow({ busy: false });
    await afterLogin();
  };

  /** After signing in: go straight into a team this account already belongs to, or continue sign-up.
   *  Coaches always type the coach code. One who already coaches a team logs in to it with the code,
   *  even if they picked «Opprett lag». */
  const afterLogin = async () => {
    const st = s();
    const r = st.flow.role;
    if (!r) return;
    const wanted: MemberRole = r;
    if (r === 'coach') {
      if (!st.flow.coachName && st.prof.coach.name) setFlow({ coachName: st.prof.coach.name });
      try {
        const coachTeams = (await myTeams())
          .filter((m) => m.role === 'coach' && m.status !== 'pending')
          .map((m) => ({ id: m.teamId, name: m.teamName }));
        setFlow({ coachTeams });
        if (coachTeams.length) {
          setFlow({ coachMode: 'join', err: '' });
          return go('coachCode');
        }
      } catch (e) {
        return setFlow({ err: errorText(e) });
      }
    }
    if (r !== 'coach') {
      try {
        const all = (await myTeams()).filter((m) => m.role === wanted);
        const mine = all.filter((m) => m.status !== 'pending');
        const pick = mine.find((m) => m.teamId === st.team?.id) || mine[0];
        if (!pick && all[0]) return waitFor(all[0]);
        if (pick) {
          const p = await getTeam(pick.teamId, wanted);
          connect(p);
          if (wanted === 'player') setProf('player', { playerId: pick.playerId });
          if (wanted === 'sub') {
            const own = p.data.subs.find((x) => x.id === mySubId());
            if (!own) {
              // Joined before but never finished paying.
              setFlow({ peek: { code: p.data.teamCode || '', teamName: p.data.teamName || '', isCoachCode: false, players: p.data.players }, terms: false });
              return go('terms');
            }
            setProf('sub', { viaId: own.via, name: own.name, active: true, cancelled: false, startedAt: own.since, autoRenew: own.autoRenew !== false });
          }
          enterApp(wanted);
          toast('Velkommen tilbake!');
          return;
        }
      } catch (e) {
        return setFlow({ err: errorText(e) });
      }
    }
    const next: Record<Role, Screen> = {
      player: 'teamCode',
      sub: 'invite',
      coach: st.flow.coachMode === 'create' ? 'createTeam' : 'coachCode',
    };
    go(next[r]);
  };

  /** Looks up a code while showing a busy state. Returns null (and shows an error) if the network fails. */
  const lookup = async (code: string) => {
    setFlow({ busy: true, err: '' });
    try {
      const p = await peekTeam(code);
      setFlow({ busy: false, peek: p ? { code, teamName: p.teamName, isCoachCode: p.isCoachCode, players: p.players } : null });
      return p;
    } catch (e) {
      setFlow({ busy: false, err: errorText(e) });
      return null;
    }
  };

  /**
   * Joins the team in flow.peek with the given role. Players usually have to wait
   * for a coach: then this returns 'pending' and nothing is connected yet.
   */
  const join = async (role: MemberRole, playerId: string | null): Promise<'ok' | 'pending' | false> => {
    const peek = s().flow.peek;
    if (!peek) return false;
    setFlow({ busy: true, err: '' });
    try {
      const p = await joinTeam(peek.code, role, playerId);
      if (!p) throw new Error('not_found');
      setFlow({ busy: false });
      if ('pending' in p) {
        const name = peek.players.find((x) => x.id === playerId)?.name || '';
        if (playerId && role === 'player')
          setFlow({ pendingTeam: { id: p.teamId, name: p.teamName, role, playerId, playerName: name } });
        return 'pending';
      }
      connect(p);
      return 'ok';
    } catch (e) {
      const name = peek.players.find((x) => x.id === playerId)?.name || 'Spilleren';
      const err =
        e instanceof PlayerTakenError
          ? name + ' er allerede koblet til en annen konto. Si fra til administratoren, så kan administratoren koble den fra.'
          : e instanceof Error && /unknown_player/.test(e.message)
            ? name + ' står ikke lenger på lista til laget. Snakk med administratoren.'
            : e instanceof Error && e.message === 'not_found'
              ? 'Fant ikke laget lenger. Sjekk koden med administratoren.'
              : errorText(e);
      setFlow({ busy: false, err });
      return false;
    }
  };

  /** Approved by the coach: show the team and sign the consent if it isn't signed yet. */
  const continueApproved = (p: TeamPayload, playerId: string) => {
    connect(p);
    setFlow({ pendingTeam: null });
    const player = p.data.players.find((x) => x.id === playerId);
    setProf('player', { playerId });
    if (player?.consent || player?.declined) return enterApp('player');
    set({ pcons: newPlayerForm(!!s().flow.adult), pcCtx: null });
    go('pconsent');
  };

  let checking = false;
  const checkPending = async (manual = false) => {
    const pt = s().flow.pendingTeam;
    if (!pt) return go('role');
    if (checking) return;
    checking = true;
    try {
      const m = (await myTeams()).find((x) => x.teamId === pt.id && x.role === pt.role);
      if (s().screen !== 'pending') return;
      if (!m || m.playerId !== pt.playerId) {
        setFlow({ pendingTeam: null, err: 'Administratoren godkjente ikke forespørselen. Sjekk at du valgte riktig, eller snakk med administratoren.' });
        return go('teamCode');
      }
      if (m.status === 'pending') {
        if (manual) toast('Administratoren har ikke godkjent ennå');
        return;
      }
      continueApproved(await getTeam(pt.id, pt.role), pt.playerId);
      toast('Administratoren har godkjent deg!');
    } catch (e) {
      if (manual) toast(errorText(e));
    } finally {
      checking = false;
    }
  };

  /** Waiting for approval on a team found after login (for example on a new phone). */
  const waitFor = (m: Membership) => {
    if (m.role !== 'player') return;
    setFlow({ pendingTeam: { id: m.teamId, name: m.teamName, role: m.role, playerId: m.playerId || '', playerName: '' } });
    go('pending');
  };

  const loadTeams = async () => {
    try {
      set({ teams: await myTeams() });
    } catch {
      // Offline or older database: keep what we had.
    }
  };

  /** Opens one of this account's teams in the given role, like logging in to it. */
  const openTeam = async (teamId: string, role: MemberRole) => {
    let p: TeamPayload;
    try {
      p = await getTeam(teamId, role);
    } catch (e) {
      if (/not_member/.test(e instanceof Error ? e.message : '')) {
        void loadTeams();
        return toast('Du er ikke lenger med på det laget.');
      }
      return toast(netError);
    }
    const m = (s().teams || []).find((x) => x.teamId === teamId && x.role === role);
    connect(p);
    set({ links: null, coaches: null, sheet: null, form: {}, openMatch: null, openEvent: null, notifyMatch: {} });
    if (role === 'player') setProf('player', { playerId: m?.playerId || null });
    if (role === 'coach') {
      const session = await currentSession();
      const signed = (p.data.coachConsents || []).filter((x) => x.contact === session?.email).pop()?.name;
      if (signed) setProf('coach', { name: signed });
    }
    if (role === 'sub') {
      const own = p.data.subs.find((x) => x.id === mySubId());
      if (!own) {
        // Joined but never finished paying, or the subscription ran out: continue the sign-up.
        return payAgain(p);
      }
      setProf('sub', { viaId: own.via, name: own.name, active: true, cancelled: false, startedAt: own.since, autoRenew: own.autoRenew !== false });
    }
    // Notifications follow the team on screen.
    if (s().pushOn) void updatePushPrefs(teamId, pushPrefs(s())).catch(() => {});
    enterApp(role);
    set({ tab: 'min' });
    toast('Du ser nå ' + (p.data.teamName || 'laget'));
  };

  const loadLinks = async () => {
    const team = s().team;
    if (!team || team.role !== 'coach') return;
    linksAt = Date.now();
    const [links, coaches] = await Promise.allSettled([teamLinks(team.id), teamCoaches(team.id)]);
    // Older database without approvals or the coach list, or offline: leave the lists as they were.
    if (links.status === 'fulfilled') set({ links: links.value });
    if (coaches.status === 'fulfilled') {
      set({ coaches: coaches.value });
      // On a new phone the name is only on the server: take it from the coach rules this account signed.
      const me = coaches.value.find((c) => c.me);
      if (!s().prof.coach.name && me?.name) setProf('coach', { name: me.name });
    }
  };

  const submitTeam = async () => {
    const c = s().flow.teamCode.replace(/\s/g, '').toUpperCase();
    if (c.length < 4) return setFlow({ err: 'Skriv inn lagkoden.' });
    const p = await lookup(c);
    if (s().flow.err) return;
    if (!p) return setFlow({ err: 'Fant ikke noe lag med den koden.' });
    setFlow({ err: '', pickId: null, search: '' });
    go('pickPlayer');
  };

  const submitPick = async () => {
    const st = s();
    const id = st.flow.pickId;
    if (!id) return setFlow({ err: 'Velg deg selv fra lista.' });
    const joined = await join('player', id);
    if (!joined) return;
    if (joined === 'pending') return go('pending');
    setProf('player', { playerId: id });
    set({ pcons: newPlayerForm(!!st.flow.adult), pcCtx: null });
    go('pconsent');
  };

  const submitInvite = async () => {
    const raw = s().flow.invite.replace(/\s/g, '').toUpperCase();
    if (raw.length < 4) return setFlow({ err: 'Skriv inn lagkoden.' });
    const p = await lookup(raw);
    if (s().flow.err) return;
    if (!p) return setFlow({ err: 'Fant ikke noe lag med den koden.' });
    const via = s().flow.inviteVia;
    setFlow({ err: '', inviteVia: via && p.players.some((x) => x.id === via) ? via : null, terms: false });
    go('terms');
  };

  const submitTerms = async () => {
    const f = s().flow;
    const name = (f.subName || '').trim().replace(/\s+/g, ' ');
    if (name.length < 2) return setFlow({ err: 'Skriv inn navnet ditt.' });
    if (!f.inviteVia) return setFlow({ err: 'Velg hvem som vervet deg.' });
    if (!f.terms) return setFlow({ err: 'Du må godta vilkårene for å fortsette.' });
    if (!(await join('sub', null))) return;
    setProf('sub', { name });
    setFlow({ err: '' });
    set({ pay: newPay() });
    go('pay');
  };

  const hasFullName = (n?: string) => (n || '').trim().split(/\s+/).length >= 2;

  const submitCoach = async () => {
    const f = s().flow;
    const c = f.coachCode.replace(/\s/g, '').toUpperCase();
    const known = !!f.coachTeams?.length;
    if (!known && !hasFullName(f.coachName)) return setFlow({ err: 'Skriv inn fornavn og etternavn.' });
    if (c.length < 4) return setFlow({ err: 'Skriv inn administratorkoden.' });
    const p = await lookup(c);
    if (s().flow.err) return;
    if (!p || !p.isCoachCode)
      return setFlow({ err: known ? 'Koden stemmer ikke. Sjekk administratorkoden, eller spør en annen administrator på laget.' : 'Koden stemmer ikke. Spør en annen administrator på laget.' });
    // Already a coach on this team: the code was right, so go straight in without signing again.
    let returning = false;
    try {
      returning = (await myTeams()).some((m) => m.role === 'coach' && m.status !== 'pending' && m.teamId === p.teamId);
    } catch (e) {
      return setFlow({ err: errorText(e) });
    }
    if (returning) {
      if (!(await join('coach', null))) return;
      // Keep the name from when they signed the coach rules on this team.
      const signed = (s().data.coachConsents || []).filter((x) => x.contact === f.contact).pop()?.name;
      const name = f.coachName.trim().replace(/\s+/g, ' ') || signed || s().prof.coach.name;
      if (name) setProf('coach', { name });
      setFlow({ coachTeams: [] });
      enterApp('coach');
      toast('Velkommen tilbake!');
      return;
    }
    // A code for another team: they join it as a new coach, so show the name field.
    if (!hasFullName(f.coachName))
      return setFlow({ coachTeams: [], coachName: s().prof.coach.name || '', err: 'Koden gjelder et annet lag. Skriv inn fornavn og etternavn for å bli administrator der.' });
    set({ pcons: { step: 1, coach: true, mode: 'join', p: null, ps: null, err: '' } });
    setFlow({ err: '' });
    go('cconsent');
  };

  const submitCreateTeam = () => {
    const f = s().flow;
    const n = (f.teamName || '').trim().replace(/\s+/g, ' ');
    const cc = (f.newCoachCode || '').trim().toUpperCase();
    const tc = (f.newTeamCode || '').trim().toUpperCase();
    if (!hasFullName(f.coachName)) return setFlow({ err: 'Skriv inn ditt fornavn og etternavn.' });
    if (n.length < 2) return setFlow({ err: 'Skriv inn navnet på laget.' });
    if (cc.length < 6) return setFlow({ err: 'Administratorkoden må ha minst 6 tegn.' });
    if (tc.length < 6) return setFlow({ err: 'Lagkoden må ha minst 6 tegn.' });
    if (cc === tc) return setFlow({ err: 'Administratorkoden og lagkoden må være forskjellige.' });
    set({ pcons: { step: 1, coach: true, mode: 'create', pending: { n, cc, tc }, p: null, ps: null, err: '' } });
    setFlow({ err: '' });
    go('cconsent');
  };

  /** Uploads a signature drawn on the canvas to the team's private folder. */
  const storeSignature = async (sig: string | null | undefined) => {
    const team = s().team;
    if (!sig || !sig.startsWith('data:') || !team) return sig || null;
    try {
      return await uploadMedia(team.id, sig, 'sig');
    } catch {
      return sig;
    }
  };

  /** One yes covers photos, video and the name in posts. Under 15 the parent's part is signed on the same form. */
  const pcFinish = async (ok: boolean, by: 'player' | 'parent' | null) => {
    const st = s();
    const c = st.pcons || ({} as SignedForm);
    const id = st.prof.player.playerId;
    const minor = !c.adult;
    setPC({ busy: true });
    const [playerSig, parentSig] = ok ? await Promise.all([storeSignature(c.ps), minor ? storeSignature(c.gs) : null]) : [null, null];
    if (id)
      updPlayer(id, {
        consent: ok
          ? {
              photo: true,
              video: true,
              name: true,
              at: Date.now(),
              adult: !minor,
              playerSig,
              parentSig,
              parentName: minor ? (c.gn || '').trim().replace(/\s+/g, ' ') : null,
            }
          : null,
        declined: ok ? null : by,
      });
    const inApp = st.pcCtx === 'app';
    set({ pcons: null, pcCtx: null });
    const no = by === 'parent' ? 'Lagret. En foresatt sa nei, så du er ikke med på bilder.' : 'Lagret. Du er ikke med på bilder.';
    if (inApp) return toast(ok ? 'Samtykket er lagret' : no);
    enterApp('player');
    toast(ok ? 'Takk! Samtykket er signert.' : no);
  };

  const payDone = () => {
    const st = s();
    const p = st.pay || newPay();
    const ctx = st.payCtx || 'flow';
    const now = Date.now();
    const last4 = p.method === 'card' ? p.num.replace(/\s/g, '').slice(-4) : st.prof.sub.last4;
    const m0 = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
    const amount = price(st);
    const team = Math.round(amount * 70) / 100;
    const autoRenew = p.autoRenew !== false;
    const addSub = (id: string, name: string, rel: string, via: string | null) =>
      setData((d) => {
        const L = d.payments || [];
        const paid = L.some((x) => x.subId === id && x.at >= m0);
        return {
          ...d,
          subs: [{ id, name, rel, via, since: now, autoRenew }, ...d.subs.filter((x) => x.id !== id)],
          payments: paid ? L : [...L, { id: 'pay' + id + now, subId: id, name, at: now, amount, team }],
        };
      });
    const subName = st.prof.sub.name || 'Abonnent';
    if (ctx === 'flow') {
      const via = st.flow.inviteVia || st.data.players[0]?.id || null;
      setProf('sub', { viaId: via, active: true, cancelled: false, method: p.method, last4, startedAt: now, autoRenew });
      addSub(mySubId(), subName, '', via);
      enterApp('sub');
      toast('Velkommen! Du følger nå laget.');
    } else {
      setProf('sub', { active: true, cancelled: false, method: p.method, last4, startedAt: now, autoRenew });
      addSub(mySubId(), subName, '', st.prof.sub.viaId);
      set({ payCtx: null, pay: null });
      toast('Abonnementet er i gang igjen');
    }
  };

  const mySubId = () => 'sub-' + s().uid;

  const mkPlayer = (players: Player[], name: string): Player => ({
    id: 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name,
    born: null,
    num: Math.max(0, ...players.map((p) => p.num || 0)) + 1,
    parent: { name: '', phone: '', email: '' },
    consent: null,
    selfLogin: false,
  });

  return {
    ...loadState(),

    refresh,
    startInvite: (code, via) => {
      set({ flow: { ...blankFlow(), role: 'sub', invite: code.toUpperCase(), inviteVia: via } });
      go('login');
    },
    toast,
    go,
    setFlow,
    setData,
    setForm,
    setProf,
    updPlayer,
    ask,
    setPC,
    setPay,
    enterApp,
    toggleTheme: () => set((st) => ({ theme: st.theme === 'dark' ? 'light' : 'dark' })),

    // ---------- Onboarding ----------

    chooseRole: (r) => {
      set({ flow: { ...blankFlow(), contact: s().flow.contact, role: r === 'player' ? null : r } });
      go(r === 'player' ? 'playerKind' : r === 'coach' ? 'coachChoice' : 'login');
    },
    choosePlayerKind: (adult) => {
      setFlow({ role: 'player', adult, err: '' });
      go('login');
    },
    chooseCoachMode: (mode) => {
      setFlow({ coachMode: mode, err: '' });
      go('login');
    },
    createAnotherTeam: () => {
      setFlow({ coachMode: 'create', coachTeams: [], err: '' });
      go('createTeam');
    },
    flowSubmit: () => {
      const handlers: Partial<Record<Screen, () => void>> = {
        login: submitLogin,
        otp: afterOtp,
        teamCode: submitTeam,
        pickPlayer: submitPick,
        invite: submitInvite,
        terms: submitTerms,
        coachCode: submitCoach,
        createTeam: submitCreateTeam,
        pending: () => void checkPending(true),
      };
      handlers[s().screen]?.();
    },
    setOtp: (raw) => {
      const v = raw.replace(/\D/g, '').slice(0, 6);
      setFlow({ otp: v, err: '' });
      if (v.length === 6) {
        clearTimeout(otpTimer);
        otpTimer = setTimeout(afterOtp, 280);
      }
    },
    suggestCodes: () => {
      const f = s().flow;
      const base = ascii((f.teamName || '').trim() || 'LAGET')
        .toUpperCase()
        .replace(/[^A-Z0-9 ]/g, '');
      const w = base.split(' ').filter(Boolean);
      const r = () => String(10 + Math.floor(Math.random() * 90));
      setFlow({ newCoachCode: (w[0] || 'LAG').slice(0, 10) + '-ADMIN' + r(), newTeamCode: w.join('').slice(0, 10) + r(), err: '' });
    },
    back: () => {
      const st = s();
      const r = st.flow.role;
      const map: Partial<Record<Screen, Screen>> = {
        playerKind: 'role',
        login: r === 'player' ? 'playerKind' : r === 'coach' ? 'coachChoice' : 'role',
        coachChoice: 'role',
        pconsent: 'pickPlayer',
        otp: 'login',
        teamCode: 'login',
        pickPlayer: 'teamCode',
        invite: 'login',
        terms: 'invite',
        coachCode: 'login',
        createTeam: 'login',
        pay: 'terms',
        pending: 'teamCode',
      };
      setFlow({ err: '' });
      go(map[st.screen] || 'role');
    },
    logout: () => {
      // Stop notifications to this phone first; that needs the account still signed in.
      void disablePush().finally(() => signOut());
      resetToStart();
      set({ pushOn: false });
    },
    leaveTeam: () => {
      const st = s();
      const team = st.team;
      if (!team) return;
      const name = teamName(st);
      const body =
        team.role === 'coach'
          ? 'Du mister tilgangen som administrator. Laget og innleggene blir liggende for de andre.'
          : team.role === 'sub'
            ? 'Abonnementet stopper, og du ser ikke bildene mer. Det du allerede har betalt, går fortsatt til laget.'
            : 'Du ser ikke bildene mer. Hjertene dine fjernes. Du kan bli med igjen senere med lagkoden.';
      ask('Forlate ' + name + '?', body, 'Forlat laget', async () => {
        try {
          await leaveTeam(team.id, team.role);
        } catch (e) {
          if (e instanceof LastCoachError) return toast('Du er eneste administrator. Gi administratorkoden til en annen først.');
          return toast(netError);
        }
        resetToStart();
        toast('Du har forlatt ' + name);
      });
    },
    deleteAccount: () => {
      ask(
        'Slette kontoen din?',
        'Kontoen din, hjertene dine og koblingen til alle lag slettes for godt. Abonnementer stopper. Betalinger blir stående i lagets regnskap. Dette kan ikke angres.',
        'Slett kontoen',
        async () => {
          try {
            await deleteMe();
          } catch (e) {
            if (e instanceof LastCoachError)
              return toast('Du er eneste administrator' + (e.team ? ' på ' + e.team : '') + '. Gi administratorkoden til en annen først.');
            return toast(netError);
          }
          void signOut();
          resetToStart();
          toast('Kontoen din er slettet');
        },
      );
    },
    resendCode,
    checkPending,
    resumeAfterLink: async (email) => {
      const st = s();
      // Same browser that asked for the code: linkSignedIn already continues sign-up.
      if (st.screen === 'app' || (st.screen === 'otp' && st.flow.contact === email)) return;
      // Opened on another device or browser: go into the account's team if it has one.
      try {
        const mine = await myTeams();
        const order: MemberRole[] = ['coach', 'player', 'sub'];
        const m = order.map((r) => mine.find((x) => x.role === r)).find(Boolean);
        if (m) {
          set({ flow: { ...blankFlow(), contact: email, role: m.role, coachMode: 'join' } });
          return afterLogin();
        }
      } catch {
        // Fall through and let the person pick a role.
      }
      setFlow({ contact: email, err: '' });
      toast('Du er logget inn som ' + email + '. Velg hvem du er for å fortsette.');
    },
    linkSignedIn: (id, email) => {
      set({ uid: id });
      const st = s();
      // Only continue sign-up if we are waiting for this email's login.
      if (st.screen !== 'otp' || st.flow.busy || st.flow.contact !== email) return;
      void afterLogin();
    },

    // ---------- Signed forms ----------

    // Under 15, part 2 is for a parent, filled in on the player's phone.
    pcNext: () => {
      const c = s().pcons || ({ step: 1 } as SignedForm);
      if (c.step === 1) {
        if (!c.p) return setPC({ err: 'Velg ett av alternativene.' });
        if (c.p === 'yes' && !c.ps) return setPC({ err: 'Skriv signaturen din i feltet.' });
        if (c.p === 'no') return pcFinish(false, 'player');
        if (!c.adult) {
          setPC({ step: 2 });
          scrollTop();
          return;
        }
        return pcFinish(true, null);
      }
      if (!c.g) return setPC({ err: 'Velg ett av alternativene.' });
      if (c.g === 'yes' && !(c.gn || '').trim()) return setPC({ err: 'Skriv navnet til den foresatte.' });
      if (c.g === 'yes' && !c.gs) return setPC({ err: 'Foresatt må signere i feltet.' });
      pcFinish(c.g === 'yes', c.g === 'yes' ? null : 'parent');
    },
    pcBack: () => {
      if (s().pcons?.step === 2) return setPC({ step: 1 });
      if (s().pcCtx === 'app') return set({ pcCtx: null, pcons: null });
      get().back();
    },
    openPlayerConsent: () => {
      const st = s();
      const me = st.data.players.find((p) => p.id === st.prof.player.playerId);
      // The year of birth decides when the coach has entered it; otherwise what the player said last time.
      const adult = me?.born != null ? new Date().getFullYear() - me.born >= 15 : (me?.consent?.adult ?? !!st.flow.adult);
      set({ pcCtx: 'app', pcons: newPlayerForm(adult) });
    },
    ccNext: async () => {
      const st = s();
      const c = st.pcons;
      if (!c?.p) return setPC({ err: 'Velg ett av alternativene.' });
      if (c.busy) return;
      if (c.p === 'no') {
        set({ pcons: null, flow: blankFlow() });
        go('role');
        toast('Du får ikke tilgang til laget uten å godta reglene.');
        return;
      }
      if (!c.ps) return setPC({ err: 'Skriv signaturen din i feltet.' });
      setPC({ busy: true });
      const cn = (st.flow.coachName || '').trim().replace(/\s+/g, ' ') || COACH;
      const rec = { id: 'cc' + Date.now(), name: cn, contact: st.flow.contact || '', at: Date.now(), sig: '', mode: c.mode || 'join' };
      if (c.mode === 'create' && c.pending) {
        const { n, cc, tc } = c.pending;
        try {
          connect(await createTeam(n, cc, tc, emptyTeam()));
          const sig = (await storeSignature(c.ps)) || '';
          setData((d) => ({ ...d, coachConsents: [{ ...rec, sig }] }));
        } catch (e) {
          set({ pcons: null });
          go('createTeam');
          setFlow({ err: e instanceof CodeTakenError ? 'En av kodene er allerede i bruk. Velg andre koder.' : errorText(e) });
          return;
        }
        setProf('coach', { name: cn });
        set({ pcons: null });
        enterApp('coach');
        set({ tab: 'min' });
        toast(n + ' er opprettet. Legg inn spillerne.');
        return;
      }
      if (!(await join('coach', null))) return setPC({ busy: false, err: s().flow.err || netError });
      const sig = (await storeSignature(c.ps)) || '';
      setProf('coach', { name: cn });
      setData((d) => ({ ...d, coachConsents: [...(d.coachConsents || []), { ...rec, sig }] }));
      set({ pcons: null });
      enterApp('coach');
      toast('Velkommen, administrator!');
    },
    ccBack: () => {
      const m = s().pcons?.mode;
      set({ pcons: null });
      go(m === 'create' ? 'createTeam' : 'coachCode');
    },

    // ---------- Payment ----------

    openPay: (ctx) => set({ payCtx: ctx, pay: newPay() }),
    payBack: () => {
      // payDone is already scheduled; leaving now would run it with the wrong context.
      if (s().pay?.busy) return;
      if (s().payCtx) return set({ payCtx: null, pay: null });
      get().back();
    },
    setCard: (field, raw) => {
      const d = raw.replace(/\D/g, '');
      if (field === 'num') return setPay({ num: d.slice(0, 16).replace(/(.{4})/g, '$1 ').trim(), err: '' });
      if (field === 'exp') {
        let e = d.slice(0, 4);
        if (e.length > 2) e = e.slice(0, 2) + '/' + e.slice(2);
        return setPay({ exp: e, err: '' });
      }
      setPay({ cvc: d.slice(0, 3), err: '' });
    },
    setPayMethod: (m) => {
      if (m === 'vipps') return toast('Vipps kommer snart');
      setPay({ method: m, err: '' });
    },
    paySubmit: () => {
      const p = s().pay || newPay();
      if (p.busy) return;
      if (p.method === 'card') {
        const n = p.num.replace(/\s/g, '');
        const [mm, yy] = p.exp.split('/');
        if (n.length < 16) return setPay({ err: 'Kortnummeret må ha 16 sifre.' });
        if (!mm || !yy || +mm < 1 || +mm > 12 || yy.length < 2) return setPay({ err: 'Sjekk utløpsdatoen (MM/ÅÅ).' });
        const now = new Date();
        if (2000 + +yy < now.getFullYear() || (2000 + +yy === now.getFullYear() && +mm < now.getMonth() + 1))
          return setPay({ err: 'Kortet har gått ut.' });
        if (p.cvc.length < 3) return setPay({ err: 'CVC er de tre sifrene bak på kortet.' });
      }
      setPay({ busy: true, err: '' });
      setTimeout(payDone, 1300);
    },

    // ---------- App ----------

    setTab: (t) => {
      set({ tab: t, openMatch: null, openEvent: null });
      scrollTop();
    },
    setFilter: (f) => set({ filter: f }),
    setKampTab: (t) => set({ kampTab: t, openMatch: null }),
    openMatchView: (id) => {
      set({ tab: 'kamper', openMatch: id });
      scrollTop();
    },
    closeMatch: () => {
      set({ openMatch: null, kampTab: 'played' });
      scrollTop();
    },
    goKamper: () => {
      set({ tab: 'kamper', kampTab: 'upcoming', openMatch: null });
      scrollTop();
    },
    toggleLike: (id) => {
      const r = s().uid;
      setData((d) => ({
        ...d,
        posts: d.posts.map((p) =>
          p.id !== id ? p : { ...p, likedBy: p.likedBy.includes(r) ? p.likedBy.filter((x) => x !== r) : [...p.likedBy, r] },
        ),
      }));
    },
    openLikes: (id) => {
      set({ sheet: 'likes', menuPost: id });
      if (!s().links || !s().coaches) void loadLinks();
    },
    addComment: (postId, text) => {
      const st = s();
      const t = text.trim().slice(0, 1000);
      if (!t) return false;
      if (st.role !== 'coach' && !canComment(st)) {
        toast('Du kan ikke kommentere ennå');
        return false;
      }
      const by =
        st.role === 'coach'
          ? { author: coachName(st), authorRole: 'Administrator' }
          : st.role === 'sub'
            ? { author: st.prof.sub.name || 'Abonnent', authorRole: 'Abonnent' }
            : memberAuthor(st);
      const c: Comment = { id: 'c' + Date.now() + Math.random().toString(36).slice(2, 6), authorId: st.uid, ...by, ts: Date.now(), text: t };
      setData((d) => ({ ...d, posts: d.posts.map((p) => (p.id === postId ? { ...p, comments: [...(p.comments || []), c] } : p)) }));
      return true;
    },
    deleteComment: (postId, commentId) =>
      ask('Slette kommentaren?', 'Kommentaren forsvinner for alle.', 'Slett', () => {
        setData((d) => ({
          ...d,
          posts: d.posts.map((p) => (p.id === postId ? { ...p, comments: (p.comments || []).filter((c) => c.id !== commentId) } : p)),
        }));
        toast('Kommentaren er slettet');
      }),
    openViewer: (postId, i) => set({ viewer: { postId, i } }),
    closeViewer: () => set({ viewer: null }),
    stepViewer: (dir) => {
      const v = s().viewer;
      if (!v) return;
      const p = s().data.posts.find((x) => x.id === v.postId);
      if (!p) return;
      set({ viewer: { ...v, i: Math.max(0, Math.min(p.media.length - 1, v.i + dir)) } });
    },
    openSheet: (sheet) => set({ sheet }),
    closeSheet: () => {
      const st = s();
      if (st.sheet === 'notifs') set({ seenNotifsAt: Date.now() });
      // Closing the composer without publishing: drop the files uploaded for it.
      if (st.sheet === 'composer' && st.draft) void deleteMedia(unpublished(st.draft.media));
      set({ sheet: null, confirm: null, menuPost: null, ...(st.sheet === 'composer' ? { draft: null } : {}) });
    },
    doConfirm: () => {
      const c = s().confirm;
      set({ sheet: null, confirm: null });
      c?.action();
    },
    toggleNotifyMatch: async (id) => {
      const on = !s().notifyMatch[id];
      const team = s().team;
      set((st) => ({ notifyMatch: { ...st.notifyMatch, [id]: on } }));
      if (!team) return toast(on ? 'Du får varsel når bildene kommer' : 'Varselet er slått av');
      if (on && !s().pushOn) {
        // The wish only reaches this phone with notifications switched on.
        if (needsHomeScreen()) {
          set((st) => ({ notifyMatch: { ...st.notifyMatch, [id]: false } }));
          return toast('Legg appen på Hjem-skjermen først. Se Varsler under Min side.');
        }
        const res = await enablePush(team.id, pushPrefs(s()));
        if (res !== 'ok') {
          set((st) => ({ notifyMatch: { ...st.notifyMatch, [id]: false } }));
          return toast(res === 'denied' ? 'Varsler er blokkert i nettleseren.' : 'Fikk ikke slått på varsler på denne mobilen.');
        }
        set({ pushOn: true });
      } else if (s().pushOn) {
        await updatePushPrefs(team.id, pushPrefs(s())).catch(() => {});
      }
      toast(on ? 'Du får varsel når bildene kommer' : 'Varselet er slått av');
    },
    addToCal: (m) => {
      const st = new Date(m.date + 'T' + m.time);
      const en = new Date(st.getTime() + 90 * 60e3);
      const f = (x: Date) => x.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
      const short = shortTeam(s());
      const title = m.home ? short + ' – ' + m.opp : m.opp + ' – ' + short;
      download(
        'kamp-' + ascii(m.opp || 'kamp').toLowerCase() + '.ics',
        [
          'BEGIN:VCALENDAR',
          'VERSION:2.0',
          'PRODID:-//InnerCircle//NO',
          'BEGIN:VEVENT',
          'UID:' + m.id + '@innercircle.no',
          'DTSTAMP:' + f(new Date()),
          'DTSTART:' + f(st),
          'DTEND:' + f(en),
          'SUMMARY:' + title + ' (G12)',
          'LOCATION:' + m.venue,
          'END:VEVENT',
          'END:VCALENDAR',
        ].join('\r\n'),
        'text/calendar',
      );
      toast('Kampen er lagt i kalenderen');
    },
    openEventView: (id) => {
      set({ tab: 'arrangement', openEvent: id });
      scrollTop();
    },
    closeEvent: () => {
      set({ openEvent: null });
      scrollTop();
    },
    addEventToCal: (e) => {
      const start = new Date(e.date + 'T' + e.time);
      const end = e.end && e.end > e.time ? new Date(e.date + 'T' + e.end) : new Date(start.getTime() + 2 * 3600e3);
      const f = (x: Date) => x.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
      const esc = (x: string) => x.replace(/\\/g, '\\\\').replace(/[,;]/g, (c) => '\\' + c).replace(/\n/g, '\\n');
      download(
        ascii(e.title || e.kind || 'arrangement').toLowerCase() + '.ics',
        [
          'BEGIN:VCALENDAR',
          'VERSION:2.0',
          'PRODID:-//InnerCircle//NO',
          'BEGIN:VEVENT',
          'UID:' + e.id + '@innercircle.no',
          'DTSTAMP:' + f(new Date()),
          'DTSTART:' + f(start),
          'DTEND:' + f(end),
          'SUMMARY:' + esc(e.title + ' (' + shortTeam(s()) + ')'),
          'LOCATION:' + esc(e.venue),
          'END:VEVENT',
          'END:VCALENDAR',
        ].join('\r\n'),
        'text/calendar',
      );
      toast('Lagt i kalenderen');
    },
    showMap: (m) => {
      try {
        window.open('https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(m.venue), '_blank', 'noopener');
      } catch {}
      toast('Åpner kart for ' + m.venue);
    },

    // ---------- Coach ----------

    openAddMatch: (id) => {
      const m = id ? s().data.matches.find((x) => x.id === id) : undefined;
      if (m)
        return set({
          sheet: 'addMatch',
          form: {
            matchId: m.id,
            note: m.note || '',
            title: m.title || '',
            opp: m.opp,
            date: m.date,
            time: m.time,
            venue: m.venue,
            home: m.home,
            kind: m.kind,
            featured: !!m.featured,
            err: '',
          },
        });
      set({
        sheet: 'addMatch',
        form: {
          note: '',
          title: '',
          opp: '',
          date: iso(new Date(Date.now() + 7 * DAY)),
          time: '12:00',
          venue: '',
          home: true,
          kind: 'Serie',
          featured: false,
          err: '',
        },
      });
    },
    saveMatch: () => {
      const f = s().form as Record<string, string | boolean>;
      const title = String(f.title || '').trim();
      const opp = String(f.opp || '').trim();
      const venue = String(f.venue || '').trim();
      if (!title && !opp) return setForm({ err: 'Gi kampen en tittel.' });
      if (!f.date) return setForm({ err: 'Velg dato for kampen.' });
      if (!f.time) return setForm({ err: 'Legg inn når kampen starter.' });
      if (!venue) return setForm({ err: 'Skriv inn hvor kampen spilles.' });
      const old = f.matchId ? s().data.matches.find((x) => x.id === f.matchId) : undefined;
      const m: Match = {
        id: old?.id || 'm' + Date.now(),
        title,
        opp,
        date: String(f.date),
        time: String(f.time),
        venue,
        home: !!f.home,
        kind: f.kind === 'Cup' ? 'Cup' : 'Serie',
        featured: !!f.featured,
        note: String(f.note || '').trim(),
        us: old ? old.us : null,
        them: old ? old.them : null,
      };
      const unfeature = (x: Match) => (m.featured && x.id !== m.id ? { ...x, featured: false } : x);
      if (old) {
        setData((d) => ({ ...d, matches: d.matches.map((x) => (x.id === m.id ? m : unfeature(x))) }));
        set({ sheet: null });
        toast('Kampen er endret');
        // Only a new time or place is worth a notification; a typo fix is not.
        if (old.date !== m.date || old.time !== m.time || old.venue !== m.venue) {
          const text = 'Endret kamp: ' + matchTitle(s(), m) + ', ' + fmtDay(m.date) + ' kl. ' + m.time + ', ' + m.venue;
          addNotif(text);
          void notify('matches', teamName(s()), text);
        }
        return;
      }
      setData((d) => ({ ...d, matches: [...d.matches.map(unfeature), m] }));
      set({ sheet: null, tab: 'kamper', kampTab: isPlayed(m) ? 'played' : 'upcoming', openMatch: null });
      scrollTop();
      toast(matchTitle(s(), m) + ' er lagt til');
      const text = 'Ny kamp: ' + matchTitle(s(), m) + ', ' + fmtDay(m.date) + ' kl. ' + m.time;
      addNotif(text);
      void notify('matches', teamName(s()), text);
    },
    deleteMatch: (id) => {
      const m = s().data.matches.find((x) => x.id === id);
      if (!m) return;
      const n = s().data.posts.filter((p) => p.matchId === id).length;
      ask(
        'Slette kampen?',
        matchTitle(s(), m) + ' forsvinner fra kamplista for alle.' + (n ? ' Innleggene fra kampen blir liggende i bildestrømmen.' : ''),
        'Slett kamp',
        () => {
          setData((d) => ({
            ...d,
            matches: d.matches.filter((x) => x.id !== id),
            posts: d.posts.map((p) => (p.matchId === id ? { ...p, matchId: null } : p)),
          }));
          set({ openMatch: null });
          toast('Kampen er slettet');
        },
      );
    },
    openAddEvent: (id) => {
      const e = id ? (s().data.events || []).find((x) => x.id === id) : undefined;
      if (e)
        return set({
          sheet: 'addEvent',
          form: { eventId: e.id, icon: e.icon, title: e.title, date: e.date, time: e.time, end: e.end || '', venue: e.venue, note: e.note || '', err: '' },
        });
      set({
        sheet: 'addEvent',
        form: { icon: 'event', title: '', date: iso(new Date(Date.now() + 7 * DAY)), time: '18:00', end: '', venue: '', note: '', err: '' },
      });
    },
    saveEvent: () => {
      const f = s().form as Record<string, string | undefined>;
      const title = String(f.title || '').trim();
      const venue = String(f.venue || '').trim();
      if (!title) return setForm({ err: 'Gi hendelsen et navn.' });
      if (!f.date) return setForm({ err: 'Velg dato.' });
      if (!f.time) return setForm({ err: 'Legg inn når det starter.' });
      if (f.end && f.end <= f.time) return setForm({ err: 'Slutt må være etter start.' });
      if (!venue) return setForm({ err: 'Skriv inn hvor det skjer.' });
      const old = f.eventId ? (s().data.events || []).find((x) => x.id === f.eventId) : undefined;
      const e: TeamEvent = {
        id: old?.id || 'e' + Date.now(),
        kind: title,
        icon: String(f.icon || 'event'),
        title,
        date: String(f.date),
        time: String(f.time),
        end: String(f.end || ''),
        venue,
        note: String(f.note || '').trim(),
        seriesId: old?.seriesId ?? null,
      };
      const when = fmtDay(e.date) + ' kl. ' + e.time;
      if (old) {
        setData((d) => ({ ...d, events: (d.events || []).map((x) => (x.id === e.id ? e : x)) }));
        set({ sheet: null });
        toast('Endringen er lagret');
        // Only a new time or place is worth a notification; a typo fix is not.
        if (old.date !== e.date || old.time !== e.time || old.venue !== e.venue) {
          const text = 'Endret: ' + e.title + ', ' + when + ', ' + e.venue;
          addNotif(text);
          void notify('matches', teamName(s()), text);
        }
        return;
      }
      setData((d) => ({ ...d, events: [...(d.events || []), e] }));
      set({ sheet: null, tab: 'arrangement', openEvent: null });
      scrollTop();
      toast(e.title + ' er lagt til');
      const text = 'Ny hendelse: ' + e.title + ', ' + when;
      addNotif(text);
      void notify('matches', teamName(s()), text);
    },
    deleteEvent: (id) => {
      const e = (s().data.events || []).find((x) => x.id === id);
      if (!e) return;
      const n = s().data.posts.filter((p) => p.eventId === id).length;
      ask(
        'Slette hendelsen?',
        e.title + ' forsvinner for alle.' + (n ? ' Innleggene fra den blir liggende i bildestrømmen.' : ''),
        'Slett',
        () => {
          setData((d) => ({
            ...d,
            events: (d.events || []).filter((x) => x.id !== id),
            posts: d.posts.map((p) => (p.eventId === id ? { ...p, eventId: null } : p)),
          }));
          set({ openEvent: null });
          toast('Hendelsen er slettet');
        },
      );
    },
    openTraining: (id) => {
      const t = id ? (s().data.trainings || []).find((x) => x.id === id) : undefined;
      set({
        sheet: 'training',
        form: t
          ? {
              trainingId: t.id,
              title: t.title,
              weekday: t.weekday,
              every: t.every,
              time: t.time,
              end: t.end,
              venue: t.venue,
              note: t.note || '',
              from: t.from,
              until: t.until || '',
              err: '',
            }
          : { title: 'Trening', weekday: 3, every: 1, time: '18:00', end: '19:30', venue: '', note: '', from: iso(new Date()), until: '', err: '' },
      });
    },
    saveTraining: () => {
      const f = s().form as Record<string, string | number | boolean>;
      const title = String(f.title || '').trim() || 'Trening';
      const venue = String(f.venue || '').trim();
      const weekday = Number(f.weekday);
      if (!(weekday >= 0 && weekday <= 6)) return setForm({ err: 'Velg hvilken dag treningen er.' });
      if (!f.time) return setForm({ err: 'Legg inn når treningen starter.' });
      if (f.end && String(f.end) <= String(f.time)) return setForm({ err: 'Slutt må være etter start.' });
      if (!venue) return setForm({ err: 'Skriv inn hvor dere trener.' });
      if (!f.from) return setForm({ err: 'Velg når den første treningen er.' });
      const until = String(f.until || '');
      if (until && until < firstOn(String(f.from), weekday)) return setForm({ err: 'Siste dag må være etter den første treningen.' });
      const old = f.trainingId ? (s().data.trainings || []).find((x) => x.id === f.trainingId) : undefined;
      const t: TrainingSeries = {
        id: old?.id || 't' + Date.now(),
        title,
        weekday,
        every: Number(f.every) === 2 ? 2 : 1,
        time: String(f.time),
        end: String(f.end || ''),
        venue,
        note: String(f.note || '').trim(),
        from: String(f.from),
        until: until || null,
        // Changes to single days only fit while the day of the week stays the same.
        changes: old && old.weekday === weekday ? old.changes : {},
      };
      setData((d) => ({ ...d, trainings: old ? (d.trainings || []).map((x) => (x.id === t.id ? t : x)) : [...(d.trainings || []), t] }));
      set({ sheet: null, tab: 'arrangement', openEvent: null });
      const when = repeatText(t).toLowerCase() + ' kl. ' + timeText(t) + ', ' + t.venue;
      if (old) {
        toast('Treningen er endret');
        if (old.weekday === t.weekday && old.every === t.every && old.time === t.time && old.end === t.end && old.venue === t.venue) return;
        const text = 'Endret trening: ' + t.title + ' ' + when;
        addNotif(text, true);
        void notify('matches', teamName(s()), text);
        return;
      }
      scrollTop();
      toast(t.title + ' er lagt inn ' + repeatText(t).toLowerCase());
      const text = 'Ny fast trening: ' + t.title + ' ' + when;
      addNotif(text, true);
      void notify('matches', teamName(s()), text);
    },
    endTraining: (id) => {
      const t = (s().data.trainings || []).find((x) => x.id === id);
      if (!t) return;
      const stop = yesterday();
      // Nothing held yet: no need to keep it around.
      const never = firstOn(t.from, t.weekday) > stop;
      ask(
        never ? 'Slette treningen?' : 'Avslutte treningen?',
        never
          ? t.title + ' ' + repeatText(t).toLowerCase() + ' forsvinner for alle.'
          : 'Det blir ingen flere ' + t.title.toLowerCase() + ' ' + repeatText(t).toLowerCase() + ' fra og med i dag.',
        never ? 'Slett' : 'Avslutt',
        () => {
          setData((d) => ({
            ...d,
            trainings: never ? (d.trainings || []).filter((x) => x.id !== id) : (d.trainings || []).map((x) => (x.id === id ? { ...x, until: stop } : x)),
          }));
          set({ openEvent: null });
          toast(never ? 'Treningen er slettet' : 'Treningen er avsluttet');
          const text = 'Ingen flere ' + t.title.toLowerCase() + ' ' + repeatText(t).toLowerCase();
          addNotif(text, true);
          void notify('matches', teamName(s()), text);
        },
      );
    },
    openTrainingDay: (seriesId, date) => {
      const t = (s().data.trainings || []).find((x) => x.id === seriesId);
      if (!t) return;
      const c = t.changes?.[date] || {};
      set({
        sheet: 'trainingDay',
        form: { seriesId, date, time: c.time || t.time, end: c.end ?? t.end, venue: c.venue || t.venue, note: c.note ?? t.note ?? '', cancelled: !!c.cancelled, err: '' },
      });
    },
    saveTrainingDay: () => {
      const f = s().form as Record<string, string | boolean>;
      const t = (s().data.trainings || []).find((x) => x.id === f.seriesId);
      if (!t) return set({ sheet: null });
      const date = String(f.date);
      const venue = String(f.venue || '').trim();
      if (!f.time) return setForm({ err: 'Legg inn når treningen starter.' });
      if (f.end && String(f.end) <= String(f.time)) return setForm({ err: 'Slutt må være etter start.' });
      if (!venue) return setForm({ err: 'Skriv inn hvor dere trener.' });
      const prev = t.changes?.[date] || {};
      const c = {
        ...(prev.cancelled ? { cancelled: true } : {}),
        ...(String(f.time) !== t.time ? { time: String(f.time) } : {}),
        ...(String(f.end || '') !== t.end ? { end: String(f.end || '') } : {}),
        ...(venue !== t.venue ? { venue } : {}),
        ...(String(f.note || '').trim() !== (t.note || '') ? { note: String(f.note || '').trim() } : {}),
      };
      const moved = (c.time || t.time) !== (prev.time || t.time) || (c.end ?? t.end) !== (prev.end ?? t.end) || (c.venue || t.venue) !== (prev.venue || t.venue);
      putChange(t.id, date, c);
      set({ sheet: null });
      toast('Treningen ' + fmtDay(date) + ' er endret');
      if (!moved) return;
      const text = 'Endret trening ' + fmtDay(date) + ': kl. ' + timeText({ time: c.time || t.time, end: c.end ?? t.end }) + ', ' + (c.venue || t.venue);
      addNotif(text, true);
      void notify('matches', teamName(s()), text);
    },
    cancelTrainingDay: (cancel) => {
      const f = s().form as Record<string, string | boolean>;
      const t = (s().data.trainings || []).find((x) => x.id === f.seriesId);
      if (!t) return set({ sheet: null });
      const date = String(f.date);
      const rest = { ...t.changes?.[date] };
      delete rest.cancelled;
      putChange(t.id, date, cancel ? { ...rest, cancelled: true } : rest);
      set({ sheet: null });
      toast(cancel ? 'Treningen ' + fmtDay(date) + ' er avlyst' : 'Treningen ' + fmtDay(date) + ' blir likevel');
      const text = (cancel ? 'Avlyst: ' : 'Blir likevel: ') + t.title.toLowerCase() + ' ' + fmtDay(date) + ' kl. ' + t.time;
      addNotif(text, true);
      void notify('matches', teamName(s()), text);
    },
    trainingToCal: (id) => {
      const t = (s().data.trainings || []).find((x) => x.id === id);
      if (!t) return;
      download('trening-' + WEEKDAYS[t.weekday].replace('ø', 'o') + '.ics', seriesIcs(t, shortTeam(s())), 'text/calendar');
      toast(isRunning(t) ? 'Treningene er lagt i kalenderen' : 'Treningen er lagt i kalenderen');
    },
    openResult: (id) => {
      const m = s().data.matches.find((x) => x.id === id);
      if (!m) return;
      set({ sheet: 'result', form: { matchId: id, us: m.us ?? 0, them: m.them ?? 0 } });
    },
    stepResult: (k, dir) => {
      const v = Number(s().form[k]) || 0;
      setForm({ [k]: Math.max(0, Math.min(30, v + dir)) });
    },
    saveResult: () => {
      const f = s().form;
      setData((d) => ({
        ...d,
        matches: d.matches.map((m) => (m.id === f.matchId ? { ...m, us: Number(f.us), them: Number(f.them) } : m)),
      }));
      set({ sheet: null });
      toast('Resultatet er lagret');
      const rm = s().data.matches.find((m) => m.id === f.matchId);
      if (rm) {
        addNotif('Resultat: ' + scoreTitle(s(), rm));
        void notify('results', teamName(s()), 'Resultat: ' + scoreTitle(s(), rm));
      }
    },
    openComposer: (postId, eventId) => {
      const st = s();
      if (!postId && !canPost(st)) return;
      let dr: Draft;
      const p = postId ? st.data.posts.find((x) => x.id === postId) : null;
      const ev = findEvent(st.data, eventId);
      if (p) {
        dr = { id: p.id, type: p.type, matchId: p.matchId || '', eventId: p.eventId || '', media: p.media.slice(), text: p.text, notify: false };
      } else if (ev) {
        dr = { id: null, type: ev.kind === 'Trening' ? 'trening' : 'beskjed', matchId: '', eventId: ev.id, media: [], text: '', notify: true };
      } else {
        const last = st.data.matches.filter(isPlayed).sort((a, b) => matchTime(b) - matchTime(a))[0];
        dr = { id: null, type: 'kamp', matchId: last ? last.id : '', media: [], text: '', notify: true };
      }
      set({ draft: dr, sheet: 'composer', menuPost: null });
    },
    setDraft: (p) => set((st) => ({ draft: st.draft ? { ...st.draft, ...p } : st.draft })),
    addFiles: async (files) => {
      const team = s().team;
      const picked = files.map(withVideoType).filter((f) => f.type.startsWith('image/') || f.type.startsWith('video/'));
      if (!team) return;
      if (!picked.length) return void toast('Velg et bilde eller en video.');
      get().setDraft({ loading: true });
      const out: Media[] = [];
      for (const f of picked.slice(0, 10)) {
        const id = 'm' + Date.now() + Math.random().toString(36).slice(2, 6);
        try {
          if (f.type.startsWith('video/')) {
            if (f.size > MAX_VIDEO) {
              toast(`Videoen er ${Math.round(f.size / 1048576)} MB, og grensen er 50 MB. Klipp den kortere på telefonen og prøv igjen.`);
              continue;
            }
            const dur = await videoDuration(f);
            out.push({ id, kind: 'video', src: await uploadMedia(team.id, f), label: 'videoklipp', dur });
          } else {
            out.push({ id, kind: 'photo', src: await uploadMedia(team.id, await resizeImage(f)), label: 'bilde' });
          }
        } catch {
          toast('Fikk ikke lastet opp ' + (f.type.startsWith('video/') ? 'videoen' : 'ett av bildene') + '. Prøv igjen.');
        }
      }
      set((st) => ({ draft: st.draft ? { ...st.draft, loading: false, media: [...st.draft.media, ...out] } : st.draft }));
    },
    removeMedia: (id) => {
      const m = s().draft?.media.find((x) => x.id === id);
      set((st) => ({ draft: st.draft && { ...st.draft, media: st.draft.media.filter((x) => x.id !== id) } }));
      // Uploaded for this draft only: delete it now. Files already in a post go when the change is published.
      if (m) void deleteMedia(unpublished([m]));
    },
    publish: () => {
      const st = s();
      const dr = st.draft;
      if (!dr) return;
      if (dr.loading) return toast('Vent til opplastingen er ferdig');
      if (!dr.text.trim() && !dr.media.length) return toast('Legg til tekst, bilder eller video først');
      const coach = st.role === 'coach';
      // Players post about a match, training or event the coaches made, never on their own.
      const ev = findEvent(st.data, dr.eventId);
      if (!coach && !st.data.matches.some((m) => m.id === dr.matchId) && (!ev || (isTraining(ev) && ev.cancelled)))
        return toast('Velg kampen, treningen eller hendelsen innlegget gjelder');
      const matchId = (dr.type === 'kamp' || !coach) && dr.matchId ? dr.matchId : null;
      const eventId = (dr.type !== 'kamp' || !coach) && dr.eventId ? dr.eventId : null;
      if (dr.id) {
        const kept = new Set(dr.media.map((m) => m.src));
        const dropped = (st.data.posts.find((p) => p.id === dr.id)?.media || []).filter((m) => !kept.has(m.src));
        void deleteMedia(dropped.map((m) => m.src));
        setData((d) => ({
          ...d,
          posts: d.posts.map((p) =>
            p.id === dr.id ? { ...p, type: dr.type, matchId, eventId, media: dr.media, text: dr.text.trim(), edited: true } : p,
          ),
        }));
        set({ sheet: null, draft: null });
        toast('Innlegget er oppdatert');
        return;
      }
      const now = Date.now();
      const by = coach ? { author: coachName(st), authorRole: 'Administrator' } : memberAuthor(st);
      const author = by.author;
      const post: Post = {
        id: 'post' + now + (coach ? '' : Math.random().toString(36).slice(2, 6)),
        type: dr.type,
        authorId: coach ? 'coach' : st.uid,
        author,
        authorRole: by.authorRole,
        ts: now,
        matchId,
        eventId,
        media: dr.media,
        tagged: [],
        text: dr.text.trim(),
        likes: 0,
        likedBy: [],
      };
      // Only coaches send notifications.
      const notifyAll = coach && dr.notify !== false;
      setData((d) => ({
        ...d,
        posts: [post, ...d.posts],
        notifs: notifyAll ? [{ id: 'n' + now, text: 'Nytt innlegg fra ' + author, ts: now, read: false, from: 'coach' as const }, ...d.notifs] : d.notifs,
      }));
      // Posted from an event: stay there and see it turn up. Otherwise go to the feed.
      set(eventId ? { sheet: null, draft: null } : { sheet: null, draft: null, tab: 'lag', filter: 'all', openMatch: null });
      // Those who asked to hear about this match get it even with notifications for posts switched off.
      if (coach && (notifyAll || matchId)) void notify('posts', teamName(s()), author + ': ' + (post.text || mediaText(post.media)).slice(0, 120), { matchId, onlyWatchers: !notifyAll });
      scrollTop();
      toast(notifyAll ? 'Publisert. Laget er varslet.' : 'Innlegget er publisert');
    },
    deletePost: (id) =>
      ask('Slette innlegget?', 'Innlegget og bildene forsvinner for alle. Dette kan ikke angres.', 'Slett', () => {
        void deleteMedia((s().data.posts.find((p) => p.id === id)?.media || []).map((m) => m.src));
        setData((d) => ({ ...d, posts: d.posts.filter((p) => p.id !== id) }));
        toast('Innlegget er slettet');
      }),
    copyCode: (code, label) => copyText(code, () => toast(label + ' er kopiert')),
    openTeamSettings: () => {
      const c = s().data;
      set({ sheet: 'teamSettings', form: { name: teamName(s()), teamCode: c.teamCode || '', coachCode: c.coachCode || '', err: '' } });
    },
    newCode: (which) => {
      const base = ascii(String(s().form.name || teamName(s())))
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, 8) || 'LAG';
      const r = () => String(100 + Math.floor(Math.random() * 900));
      setForm({ [which]: which === 'coachCode' ? base + '-ADMIN' + r() : base + r(), err: '' });
    },
    saveTeamSettings: async () => {
      const st = s();
      const team = st.team;
      const f = st.form;
      if (!team || team.role !== 'coach' || f.busy) return;
      const name = String(f.name || '').trim().replace(/\s+/g, ' ');
      const tc = String(f.teamCode || '').replace(/\s/g, '').toUpperCase();
      const cc = String(f.coachCode || '').replace(/\s/g, '').toUpperCase();
      if (name.length < 2) return setForm({ err: 'Skriv inn navnet på laget.' });
      if (tc.length < 6) return setForm({ err: 'Lagkoden må ha minst 6 tegn.' });
      if (cc.length < 6) return setForm({ err: 'Administratorkoden må ha minst 6 tegn.' });
      if (tc === cc) return setForm({ err: 'Administratorkoden og lagkoden må være forskjellige.' });
      const changed = { name: name !== teamName(st), team: tc !== st.data.teamCode, coach: cc !== st.data.coachCode };
      if (!changed.name && !changed.team && !changed.coach) return set({ sheet: null });
      setForm({ busy: true, err: '' });
      try {
        const p = await updateTeam(team.id, name, tc, cc);
        applyServer(p);
        if (pending.length) void flush();
      } catch (e) {
        return setForm({
          busy: false,
          err: e instanceof CodeTakenError ? 'En av kodene er allerede i bruk på et annet lag. Velg en annen.' : netError,
        });
      }
      set({ sheet: null, form: {} });
      toast(changed.team || changed.coach ? 'Lagret. De gamle kodene virker ikke lenger.' : 'Navnet er endret');
    },
    remindConsent: (ids) => {
      const players = s().data.players.filter((p) => ids.includes(p.id));
      if (!players.length) return;
      const now = Date.now();
      setData((d) => ({ ...d, reminders: { ...(d.reminders || {}), ...Object.fromEntries(players.map((p) => [p.id, now])) } }));
      toast(players.length === 1 ? 'Påminnelse sendt til ' + firstName(players[0].name) : 'Påminnelse sendt til ' + players.length + ' spillere');
      void notify('reminders', teamName(s()), 'Husk å svare på samtykket om bilder i appen.', { playerIds: players.map((p) => p.id) });
    },
    dismissReport: (id) => {
      setData((d) => ({ ...d, reports: (d.reports || []).filter((r) => r.id !== id) }));
      toast('Markert som ferdig');
    },
    openPrice: () => set({ sheet: 'price', form: { price: String(price(s())), err: '' } }),
    stepPrice: (dir) => {
      const v = parseInt(String(s().form.price), 10) || 0;
      setForm({ price: String(Math.max(10, Math.min(200, v + dir * 5))), err: '' });
    },
    savePrice: () => {
      const v = parseInt(String(s().form.price), 10);
      if (!v || v < 10 || v > 200) return setForm({ err: 'Prisen må være mellom 10 og 200 kr.' });
      setData((d) => ({ ...d, price: v }));
      set({ sheet: null });
      toast('Prisen er nå ' + v + ' kr i måneden');
    },
    openPayout: () => {
      const p = s().data.payout;
      set({ sheet: 'payout', form: { acctOwner: p?.owner || teamName(s()), acct: p?.acct ? fmtAcct(p.acct) : '', err: '' } });
    },
    savePayout: () => {
      const f = s().form;
      const owner = String(f.acctOwner || '').trim();
      const n = String(f.acct || '').replace(/\D/g, '');
      if (!owner) return setForm({ err: 'Skriv inn hvem som eier kontoen.' });
      if (n.length !== 11) return setForm({ err: 'Kontonummeret må ha 11 siffer.' });
      if (!validAcct(n)) return setForm({ err: 'Kontonummeret ser ikke riktig ut. Sjekk sifrene.' });
      setData((d) => ({ ...d, payout: { owner, acct: n, at: Date.now() } }));
      set({ sheet: null });
      toast('Pengene går nå til ' + fmtAcct(n));
    },
    removeSub: (id) => {
      const x = s().data.subs.find((v) => v.id === id);
      ask('Fjerne tilgangen?', (x ? x.name : 'Abonnenten') + ' mister tilgang til bildestrømmen og blir ikke trukket mer.', 'Fjern tilgang', () => {
        setData((d) => ({ ...d, subs: d.subs.filter((v) => v.id !== id) }));
        toast('Tilgangen er fjernet');
      });
    },
    addPlayer: () => {
      const name = s().pf.name.trim().replace(/\s+/g, ' ');
      const setPf = (p: Partial<AppState['pf']>) => set((st) => ({ pf: { ...st.pf, ...p } }));
      if (name.split(' ').length < 2) return setPf({ err: 'Skriv inn fornavn og etternavn.' });
      if (s().data.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) return setPf({ err: name + ' står allerede på lista.' });
      setData((d) => ({ ...d, players: [...d.players, mkPlayer(d.players, name)] }));
      setPf({ name: '', err: '' });
      toast(name + ' er lagt til');
    },
    openEditPlayer: (id) => {
      const p = s().data.players.find((x) => x.id === id);
      if (!p) return;
      set({
        sheet: 'editPlayer',
        form: {
          playerId: id,
          name: p.name,
          num: p.num ? String(p.num) : '',
          born: p.born ? String(p.born) : '',
          parentName: p.parent?.name || '',
          parentPhone: p.parent?.phone || '',
          parentEmail: p.parent?.email || '',
          err: '',
        },
      });
    },
    savePlayer: () => {
      const f = s().form;
      const id = String(f.playerId || '');
      const p = s().data.players.find((x) => x.id === id);
      if (!p) return set({ sheet: null });
      const name = String(f.name || '').trim().replace(/\s+/g, ' ');
      const numText = String(f.num || '').trim();
      const bornText = String(f.born || '').trim();
      const num = numText ? parseInt(numText, 10) : 0;
      const born = bornText ? parseInt(bornText, 10) : null;
      const year = new Date().getFullYear();
      const parentEmail = String(f.parentEmail || '').trim().toLowerCase();
      if (name.split(' ').length < 2) return setForm({ err: 'Skriv inn fornavn og etternavn.' });
      if (s().data.players.some((x) => x.id !== id && x.name.toLowerCase() === name.toLowerCase()))
        return setForm({ err: name + ' står allerede på lista.' });
      if (numText && (!/^\d+$/.test(numText) || num > 99)) return setForm({ err: 'Draktnummeret må være mellom 0 og 99.' });
      if (bornText && (!/^\d{4}$/.test(bornText) || born! < year - 30 || born! > year - 3))
        return setForm({ err: 'Skriv fødselsåret med fire sifre, for eksempel ' + (year - 12) + '.' });
      if (parentEmail && !isEmail(parentEmail)) return setForm({ err: 'E-posten til foresatt ser ikke riktig ut.' });
      const taken = numText ? s().data.players.find((x) => x.id !== id && x.num === num) : undefined;
      updPlayer(id, {
        name,
        num,
        born,
        parent: { name: String(f.parentName || '').trim(), phone: String(f.parentPhone || '').trim(), email: parentEmail },
      });
      set({ sheet: null });
      toast(taken ? 'Lagret. Obs: ' + firstName(taken.name) + ' har også nummer ' + num + '.' : 'Endringene er lagret');
    },
    removePlayer: (id) => {
      const p = s().data.players.find((x) => x.id === id);
      ask(
        'Fjerne ' + (p ? firstName(p.name) : 'spilleren') + '?',
        (p ? p.name : 'Spilleren') + ' fjernes fra laget og kan ikke merkes i nye innlegg.',
        'Fjern',
        async () => {
          setData((d) => ({
            ...d,
            players: d.players.filter((x) => x.id !== id),
            posts: d.posts.map((q) => ({ ...q, tagged: q.tagged.filter((t) => t !== id) })),
          }));
          toast('Spilleren er fjernet');
          // Unlink the player's own account too, so it no longer gets into the team.
          const team = s().team;
          if (!team) return;
          try {
            const links = (await teamLinks(team.id)).filter((l) => l.playerId === id);
            await Promise.all(links.map((l) => decideLink(team.id, l.userId, l.role, false)));
          } catch {
            // Older database without approvals, or offline. They lose access once the list no longer has the player.
          }
          void loadLinks();
        },
      );
    },
    loadLinks,
    loadTeams,
    switchTeam: (teamId, role) => {
      const m = (s().teams || []).find((x) => x.teamId === teamId && x.role === role);
      if (!m) return;
      if (m.status === 'pending') return toast('Administratoren har ikke godkjent deg ennå');
      // Coaches always type the coach code to get in, also when switching.
      if (role === 'coach') return set({ sheet: 'switchTeam', form: { teamId, teamName: m.teamName, code: '', err: '' } });
      void openTeam(teamId, role);
    },
    submitSwitchCode: async () => {
      const f = s().form;
      if (f.busy) return;
      const teamId = String(f.teamId || '');
      const code = String(f.code || '').replace(/\s/g, '').toUpperCase();
      if (code.length < 4) return setForm({ err: 'Skriv inn administratorkoden.' });
      setForm({ busy: true, err: '' });
      let p;
      try {
        p = await peekTeam(code);
      } catch {
        return setForm({ busy: false, err: netError });
      }
      if (!p || !p.isCoachCode || p.teamId !== teamId)
        return setForm({ busy: false, err: 'Koden stemmer ikke. Spør en annen administrator på laget.' });
      await openTeam(teamId, 'coach');
      setForm({ busy: false });
    },
    removeCoach: (userId) => {
      const team = s().team;
      const c = s().coaches?.find((x) => x.userId === userId);
      if (!team || !c) return;
      const who = c.name || c.email || 'Administratoren';
      ask('Fjerne ' + who + '?', who + ' mister tilgangen som administrator på laget. Innleggene blir liggende.', 'Fjern', async () => {
        set((st) => ({ coaches: (st.coaches || []).filter((x) => x.userId !== userId) }));
        try {
          await removeCoach(team.id, userId);
          toast(who + ' er fjernet');
        } catch {
          toast(netError);
        }
        void loadLinks();
      });
    },
    deleteTeam: async () => {
      const st = s();
      const team = st.team;
      if (!team || team.role !== 'coach' || st.form.busy) return;
      const name = teamName(st);
      if (String(st.form.confirm || '').trim().toLowerCase() !== name.trim().toLowerCase())
        return setForm({ err: 'Skriv navnet på laget nøyaktig som det står.' });
      setForm({ busy: true, err: '' });
      await deleteTeamFiles(team.id);
      try {
        await deleteTeam(team.id, name);
      } catch {
        return setForm({ busy: false, err: netError });
      }
      resetToStart();
      toast(name + ' er slettet');
    },
    decide: (userId, role, approve) => {
      const team = s().team;
      if (!team) return;
      const run = async () => {
        set((st) => ({
          links: approve
            ? (st.links || []).map((l) => (l.userId === userId && l.role === role ? { ...l, status: 'active' as const } : l))
            : (st.links || []).filter((l) => !(l.userId === userId && l.role === role)),
        }));
        try {
          await decideLink(team.id, userId, role, approve);
          toast(approve ? 'Godkjent' : 'Koblet fra');
        } catch (e) {
          toast(errorText(e));
        }
        void loadLinks();
      };
      if (approve) return void run();
      const l = s().links?.find((x) => x.userId === userId && x.role === role);
      const name = s().data.players.find((p) => p.id === l?.playerId)?.name || 'spilleren';
      const who = l?.email || 'kontoen';
      ask(
        l?.status === 'pending' ? 'Avvise forespørselen?' : 'Koble fra kontoen?',
        who + ' blir ikke koblet til ' + name + ' og ser ikke laget. De kan prøve på nytt med lagkoden.',
        l?.status === 'pending' ? 'Avvis' : 'Koble fra',
        () => void run(),
      );
    },

    // ---------- Subscriber / family ----------

    cancelSub: () => {
      const until = nextChargeText(s().prof.sub.startedAt);
      ask(
        'Si opp abonnementet?',
        'Du blir ikke trukket mer. Du ser bildene til ' + until + '. Det du allerede har betalt, går fortsatt til laget.',
        'Si opp',
        () => {
          // Stays on the list without renewing; the database ends the access at the next monthly date.
          setProf('sub', { cancelled: true, autoRenew: false });
          setData((d) => ({ ...d, subs: d.subs.map((x) => (x.id === mySubId() ? { ...x, autoRenew: false } : x)) }));
          toast('Abonnementet er sagt opp');
        },
      );
    },
    copyInvite: (link) =>
      copyText(link, () => {
        set({ copied: true });
        clearTimeout(copiedTimer);
        copiedTimer = setTimeout(() => set({ copied: false }), 2000);
        toast('Lenken er kopiert');
      }),
    shareInvite: (link) => {
      const data = { title: 'Følg ' + teamName(s()) + ' på InnerCircle', text: 'Bli med i lagets lukkede bildestrøm.', url: link };
      if (typeof navigator.share === 'function') navigator.share(data).catch(() => {});
      else get().copyInvite(link);
    },
    // ---------- Everyone ----------

    openReport: (postId) => set({ sheet: 'report', menuPost: null, form: { postId: postId || '', text: '', err: '' } }),
    sendReport: async () => {
      const st = s();
      const f = st.form;
      if (f.busy) return;
      const postId = String(f.postId || '') || null;
      const text = String(f.text || '').trim().slice(0, 1000);
      if (!postId && text.length < 3) return setForm({ err: 'Skriv hva du lurer på.' });
      setForm({ busy: true, err: '' });
      const session = await currentSession();
      const P = st.data.players;
      const name =
        st.role === 'player'
          ? P.find((p) => p.id === st.prof.player.playerId)?.name
          : st.prof.sub.name;
      const now = Date.now();
      setData((d) => ({
        ...d,
        reports: [
          ...(d.reports || []),
          { id: 'r' + now, by: st.uid, name: name || 'Ukjent', contact: session?.email || st.flow.contact || '', postId, text: text || 'Vil at innlegget blir sett på', at: now },
        ],
      }));
      set({ sheet: null, form: {} });
      toast(postId ? 'Takk! Administratorene ser på innlegget.' : 'Sendt til administratorene. De svarer på e-post.');
    },
  };
});

/** Saves the persisted part of the state whenever it changes. Returns an unsubscribe function. */
export function startPersistence() {
  let last = '';
  let warned = false;
  const save = (st: Store) => {
    const o: Record<string, unknown> = {};
    for (const k of Object.keys(st) as (keyof Store)[]) {
      if (typeof st[k] === 'function' || (EPHEMERAL_KEYS as string[]).includes(k)) continue;
      o[k] = st[k];
    }
    const str = JSON.stringify(o);
    if (str === last) return;
    last = str;
    try {
      localStorage.setItem(LS_KEY, str);
    } catch {
      if (!warned) {
        warned = true;
        setTimeout(() => st.toast('Lagringsplassen er full. Prøv færre eller mindre bilder.'), 0);
      }
    }
  };
  save(useStore.getState());
  return useStore.subscribe(save);
}

/** Receipt text for a subscriber's payment. */
export function receiptText(team: string, at: number, amount: string, method: string) {
  return [
    'KVITTERING – InnerCircle',
    '',
    team,
    'Abonnement, ' + new Date(at).toLocaleDateString(NB, { month: 'long', year: 'numeric' }),
    'Dato: ' + fmtDate(at),
    'Beløp: ' + amount,
    'Betalt med: ' + method,
  ].join('\n');
}

/** What this device wants push notifications about, including matches it asked to hear about. */
export function pushPrefs(st: Pick<AppState, 'prof' | 'notifyMatch' | 'data'>): PushPrefs {
  const nf = st.prof.sub.notify || { posts: true, matches: true, results: true };
  const recent = Date.now() - 14 * DAY;
  const matchIds = st.data.matches.filter((m) => st.notifyMatch[m.id] && matchTime(m) > recent).map((m) => m.id);
  return { posts: nf.posts, matches: nf.matches, results: nf.results, matchIds };
}
