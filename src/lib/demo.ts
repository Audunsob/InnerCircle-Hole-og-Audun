import type { ModViewAs } from './supabase';
import type { Match, Post, TeamData } from './types';

/**
 * The made-up team shown at /demo. No real people: every name is invented and the pictures are
 * drawings in public/demo. Dates are set relative to today so the program always has something coming.
 */
export const DEMO_TEAM_ID = 'demo';

const DAY = 864e5;
const today = new Date();
today.setHours(0, 0, 0, 0);
/** yyyy-mm-dd, `offset` days from today. */
const day = (offset: number) => {
  const d = new Date(today.getTime() + offset * DAY);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};
/** A moment `offset` days from today at hh:mm. */
const at = (offset: number, time: string) => new Date(day(offset) + 'T' + time).getTime();
const ago = (hours: number) => Date.now() - hours * 3600e3;

// Matches are on Saturdays. PAST(n) is the nth Saturday before today, NEXT(n) the nth after it.
const sinceSat = (today.getDay() + 1) % 7 || 7;
const PAST = (n: number) => -sinceSat - 7 * (n - 1);
const NEXT = (n: number) => ((7 - sinceSat) % 7 || 7) + 7 * (n - 1);

const COACH = { authorId: 'demo-coach', author: 'Kari Nordby', authorRole: 'Administrator' };
const photo = (id: string, file: string, label: string) => ({ id, kind: 'photo' as const, src: '/demo/' + file + '.svg', label });

// The story, oldest first: a cup weekend in Bakkebygda three Saturdays ago (lost the semifinal, won
// bronze), a draw away at Nordstrand, a training, pizza night on Friday and a home win over Solvik
// last Saturday. Then the team photo. Coming up: two league matches, the season party and a winter cup.
const CUP = PAST(3);
const NORDSTRAND = PAST(2);
const SOLVIK = PAST(1);

const matches: Match[] = [
  { id: 'm3', title: 'Bakkebygda-cupen, semifinale', opp: 'Bakkebygda', date: day(CUP), time: '11:00', venue: 'Bakkebygda idrettspark', home: false, kind: 'Cup', us: 1, them: 2 },
  { id: 'm3b', title: 'Bakkebygda-cupen, bronsefinale', opp: 'Kvernhaug', date: day(CUP), time: '15:00', venue: 'Bakkebygda idrettspark', home: false, kind: 'Cup', us: 2, them: 0 },
  { id: 'm2', opp: 'Nordstrand', date: day(NORDSTRAND), time: '14:30', venue: 'Nordstrand stadion', home: false, kind: 'Serie', us: 2, them: 2 },
  { id: 'm1', opp: 'Solvik', date: day(SOLVIK), time: '12:00', venue: 'Fjellby kunstgress', home: true, kind: 'Serie', us: 3, them: 1 },
  { id: 'm4', opp: 'Elvetangen', date: day(NEXT(1)), time: '13:00', venue: 'Elvetangen idrettspark', home: false, kind: 'Serie', featured: true, us: null, them: null },
  { id: 'm5', opp: 'Holmlia Nord', date: day(NEXT(2)), time: '12:00', venue: 'Fjellby kunstgress', home: true, kind: 'Serie', note: 'Sesongens siste seriekamp.', us: null, them: null },
  { id: 'm6', title: 'Vintercupen, gruppespill', opp: 'Strandvik', date: day(NEXT(5)), time: '10:00', venue: 'Sentrumshallen', home: true, kind: 'Cup', us: null, them: null },
];

const posts: Post[] = [
  {
    id: 'p0',
    type: 'beskjed',
    ...COACH,
    ts: ago(2),
    matchId: null,
    media: [photo('i0', 'lagbilde', 'Lagbildet')],
    text: 'Årets lagbilde er klart! Tusen takk til alle som stilte opp. Del det gjerne med resten av familien.',
    tagged: [],
    likes: 38,
    likedBy: [],
    comments: [
      { id: 'c0', authorId: 'demo-s4', author: 'Morfar Leif', authorRole: 'Abonnent', ts: ago(1), text: 'Det henger på kjøleskapet allerede!' },
    ],
  },
  {
    id: 'p1',
    type: 'kamp',
    ...COACH,
    ts: at(SOLVIK, '14:30'),
    matchId: 'm1',
    media: [photo('i1', 'resultat', 'Resultattavla')],
    text: 'For en kamp! Laget snudde 0–1 til 3–1 etter pause, og hele benken var med. Takk til alle som kom og heiet!',
    tagged: [],
    likes: 24,
    likedBy: [],
    comments: [
      { id: 'c1', authorId: 'demo-s1', author: 'Bestemor Ingrid', authorRole: 'Abonnent', ts: at(SOLVIK, '15:10'), text: 'Så gøy å se! Heia Fjellby 💪' },
      { id: 'c2', authorId: 'demo-s2', author: 'Onkel Per', authorRole: 'Abonnent', ts: at(SOLVIK, '19:45'), text: 'Synd jeg ikke kunne komme denne gangen. Neste hjemmekamp er jeg der!' },
    ],
  },
  {
    id: 'p1b',
    type: 'kamp',
    ...COACH,
    ts: at(SOLVIK, '14:15'),
    matchId: 'm1',
    media: [photo('i1b', 'mal', 'Målet til 2–1')],
    text: 'Her sitter 2–1! Langskudd rett i krysset med ti minutter igjen.',
    tagged: [],
    likes: 19,
    likedBy: [],
  },
  {
    id: 'p2',
    type: 'beskjed',
    ...COACH,
    ts: at(SOLVIK - 1, '20:30'),
    matchId: null,
    eventId: 'e1',
    media: [photo('i3', 'pizza', 'Pizzakveld')],
    text: 'Pizzakveld i klubbhuset før morgendagens kamp mot Solvik. Det ble mye latter og litt for mye ost.',
    tagged: [],
    likes: 17,
    likedBy: [],
    comments: [{ id: 'c3', authorId: 'demo-s3', author: 'Tante Mona', authorRole: 'Abonnent', ts: at(SOLVIK - 1, '21:15'), text: 'Koselig! 🍕 Lykke til i morgen!' }],
  },
  {
    id: 'p3b',
    type: 'beskjed',
    ...COACH,
    ts: at(NORDSTRAND + 3, '19:30'),
    matchId: null,
    media: [photo('i4b', 'bane', 'Trening')],
    text: 'Ny øvelse på trening i dag: pasninger på tid mellom kjeglene. Rekorden står på 38 sekunder.',
    tagged: [],
    likes: 9,
    likedBy: [],
  },
  {
    id: 'p3',
    type: 'kamp',
    ...COACH,
    ts: at(NORDSTRAND, '17:00'),
    matchId: 'm2',
    media: [photo('i4', 'ball', 'Kampballen')],
    text: 'Uavgjort 2–2 borte mot Nordstrand. Tøff motstand, men laget ga seg aldri.',
    tagged: [],
    likes: 12,
    likedBy: [],
  },
  {
    id: 'p4',
    type: 'beskjed',
    ...COACH,
    ts: at(CUP, '17:45'),
    matchId: 'm3b',
    media: [photo('i6', 'pokal', 'Bronsepokalen')],
    text: 'Bronse i Bakkebygda-cupen! Etter tapet i semifinalen vant laget bronsefinalen 2–0 og tar med seg pokalen hjem.',
    tagged: [],
    likes: 31,
    likedBy: [],
    comments: [{ id: 'c4', authorId: 'demo-s1', author: 'Bestemor Ingrid', authorRole: 'Abonnent', ts: at(CUP, '18:20'), text: 'Stolt av dere!' }],
  },
  {
    id: 'p5',
    type: 'kamp',
    ...COACH,
    ts: at(CUP, '13:00'),
    matchId: 'm3',
    media: [photo('i7', 'heiagjeng', 'Heiagjengen')],
    text: 'Tap 1–2 i semifinalen, men for en heiagjeng! Dere hørtes over hele anlegget. Bronsefinalen spilles klokka 15.',
    tagged: [],
    likes: 27,
    likedBy: [],
    comments: [{ id: 'c5', authorId: 'demo-s3', author: 'Tante Mona', authorRole: 'Abonnent', ts: at(CUP, '13:20'), text: 'Vi stiller med enda flere flagg neste gang!' }],
  },
  {
    id: 'p6',
    type: 'beskjed',
    ...COACH,
    ts: at(CUP, '08:30'),
    matchId: null,
    eventId: 'e2',
    media: [photo('i5', 'buss', 'På vei til cupen')],
    text: 'Bussen har kjørt! Neste stopp er Bakkebygda-cupen. Første kamp er klokka 11.',
    tagged: [],
    likes: 14,
    likedBy: [],
  },
];

const data: TeamData = {
  teamName: 'Fjellby IL G14',
  teamCode: 'DEMO',
  price: 29,
  players: [],
  matches,
  events: [
    { id: 'e2', kind: 'Cup', icon: 'emoji_events', title: 'Bakkebygda-cupen', date: day(CUP), time: '08:00', end: '18:00', venue: 'Bakkebygda idrettspark' },
    { id: 'e1', kind: 'Pizzakveld', icon: 'local_pizza', title: 'Pizzakveld', date: day(SOLVIK - 1), time: '18:00', end: '20:00', venue: 'Klubbhuset' },
    { id: 'e3', kind: 'Sesongavslutning', icon: 'celebration', title: 'Sesongavslutning', date: day(NEXT(2) + 1), time: '17:00', end: '20:00', venue: 'Klubbhuset' },
  ],
  trainings: [],
  posts,
  subs: [],
  notifs: [
    { id: 'n0', text: 'Nytt innlegg: Årets lagbilde', ts: ago(2), read: false },
    { id: 'n1', text: 'Nytt innlegg: Fjellby 3–1 Solvik', ts: at(SOLVIK, '14:30'), read: true },
    { id: 'n2', text: 'Ny kamp i programmet: Elvetangen – Fjellby', ts: at(NORDSTRAND + 1, '10:00'), read: true },
  ],
  account: { connected: false, bank: '', number: '' },
  ytdBase: 0,
  reminders: {},
  reports: [],
};

/** A copy of the made-up team's document, for the test mode on the moderator page. */
export const demoTeamData = (): TeamData => structuredClone(data);

export const demoView = (): ModViewAs => ({
  payload: { teamId: DEMO_TEAM_ID, role: 'sub', version: 1, data },
  playerId: null,
  name: 'Gjest',
  email: null,
  links: [],
  coaches: [],
  teams: [{ teamId: DEMO_TEAM_ID, teamName: data.teamName!, role: 'sub', playerId: null, status: 'active' }],
});
