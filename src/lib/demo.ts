import type { ModViewAs } from './supabase';
import type { Match, Post, TeamData } from './types';

/**
 * The made-up team shown at /demo. No real people: every name is invented and the pictures are
 * drawings in public/demo. Dates are set relative to today so the program always has something coming.
 */
export const DEMO_TEAM_ID = 'demo';

const DAY = 864e5;
const day = (offset: number) => {
  const d = new Date(Date.now() + offset * DAY);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};
const ago = (hours: number) => Date.now() - hours * 3600e3;

const COACH = { authorId: 'demo-coach', author: 'Kari Nordby', authorRole: 'Administrator' };
const photo = (id: string, file: string, label: string) => ({ id, kind: 'photo' as const, src: '/demo/' + file + '.svg', label });

const matches: Match[] = [
  { id: 'm1', opp: 'Solvik', date: day(-9), time: '12:00', venue: 'Fjellby kunstgress', home: true, kind: 'Serie', us: 3, them: 1 },
  { id: 'm2', opp: 'Nordstrand', date: day(-16), time: '14:30', venue: 'Nordstrand stadion', home: false, kind: 'Serie', us: 2, them: 2 },
  { id: 'm3', opp: 'Bakkebygda', date: day(-23), time: '11:00', venue: 'Fjellby kunstgress', home: true, kind: 'Cup', us: 1, them: 2 },
  { id: 'm4', opp: 'Elvetangen', date: day(3), time: '13:00', venue: 'Elvetangen idrettspark', home: false, kind: 'Serie', featured: true, us: null, them: null },
  { id: 'm5', opp: 'Holmlia Nord', date: day(10), time: '12:00', venue: 'Fjellby kunstgress', home: true, kind: 'Serie', us: null, them: null },
  { id: 'm6', title: 'Vintercupen, gruppespill', opp: 'Strandvik', date: day(17), time: '10:00', venue: 'Sentrumshallen', home: true, kind: 'Cup', us: null, them: null },
];

const posts: Post[] = [
  {
    id: 'p1',
    type: 'kamp',
    ...COACH,
    ts: ago(3),
    matchId: 'm1',
    media: [photo('i1', 'resultat', 'Resultattavla'), photo('i2', 'ball', 'Kampballen')],
    text: 'For en kamp! Laget snudde 0–1 til 3–1 etter pause, og hele benken var med. Takk til alle som kom og heiet!',
    tagged: [],
    likes: 24,
    likedBy: [],
    comments: [
      { id: 'c1', authorId: 'demo-s1', author: 'Bestemor Ingrid', authorRole: 'Abonnent', ts: ago(2.5), text: 'Så gøy å se! Heia Fjellby 💪' },
      { id: 'c2', authorId: 'demo-s2', author: 'Onkel Per', authorRole: 'Abonnent', ts: ago(1), text: 'Synd jeg ikke kunne komme denne gangen. Neste kamp er jeg der!' },
    ],
  },
  {
    id: 'p2',
    type: 'beskjed',
    ...COACH,
    ts: ago(26),
    matchId: null,
    eventId: 'e1',
    media: [photo('i3', 'pizza', 'Pizzakveld')],
    text: 'Pizzakveld etter siste trening før høstferien. Det ble mye latter og litt for mye ost.',
    tagged: [],
    likes: 17,
    likedBy: [],
    comments: [{ id: 'c3', authorId: 'demo-s3', author: 'Tante Mona', authorRole: 'Abonnent', ts: ago(20), text: 'Koselig! 🍕' }],
  },
  {
    id: 'p3',
    type: 'kamp',
    ...COACH,
    ts: ago(24 * 15),
    matchId: 'm2',
    media: [photo('i4', 'bane', 'Oppvarming')],
    text: 'Uavgjort borte mot Nordstrand. Tøff motstand, men laget ga seg aldri.',
    tagged: [],
    likes: 12,
    likedBy: [],
  },
  {
    id: 'p4',
    type: 'beskjed',
    ...COACH,
    ts: ago(24 * 20),
    matchId: null,
    eventId: 'e2',
    media: [photo('i5', 'buss', 'På vei til cup'), photo('i6', 'pokal', 'Pokalen')],
    text: 'Cuphelg! Vi kom ikke helt til topps denne gangen, men stemningen i bussen hjem var gull verdt.',
    tagged: [],
    likes: 31,
    likedBy: [],
    comments: [{ id: 'c4', authorId: 'demo-s1', author: 'Bestemor Ingrid', authorRole: 'Abonnent', ts: ago(24 * 19), text: 'Stolt av dere!' }],
  },
];

const data: TeamData = {
  teamName: 'Fjellby IL G14',
  teamCode: 'DEMO',
  price: 29,
  players: [],
  matches,
  events: [
    { id: 'e1', kind: 'Pizzakveld', icon: 'local_pizza', title: 'Pizzakveld', date: day(-1), time: '18:00', end: '20:00', venue: 'Klubbhuset' },
    { id: 'e2', kind: 'Cuptur', icon: 'directions_bus', title: 'Cuptur til Bakkebygda', date: day(-23), time: '08:00', venue: 'Bakkebygda' },
    { id: 'e3', kind: 'Sesongavslutning', icon: 'celebration', title: 'Sesongavslutning', date: day(24), time: '17:00', end: '20:00', venue: 'Klubbhuset' },
  ],
  trainings: [],
  posts,
  subs: [],
  notifs: [
    { id: 'n1', text: 'Nytt innlegg: Fjellby 3–1 Solvik', ts: ago(3), read: false },
    { id: 'n2', text: 'Ny kamp i programmet: Elvetangen – Fjellby', ts: ago(30), read: true },
  ],
  account: { connected: false, bank: '', number: '' },
  ytdBase: 0,
  reminders: {},
  reports: [],
};

export const demoView = (): ModViewAs => ({
  payload: { teamId: DEMO_TEAM_ID, role: 'sub', version: 1, data },
  playerId: null,
  name: 'Demo',
  email: null,
  links: [],
  coaches: [],
  teams: [{ teamId: DEMO_TEAM_ID, teamName: data.teamName!, role: 'sub', playerId: null, status: 'active' }],
});
