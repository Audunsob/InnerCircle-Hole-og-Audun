import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';
import { VAPID_PUBLIC_KEY } from '@/lib/push';
import { SUPABASE_KEY, SUPABASE_URL } from '@/lib/supabase';
const KINDS = new Set(['posts', 'matches', 'results', 'reminders']);

type Target = { endpoint: string; p256dh: string; auth: string };
type Body = {
  teamId?: string;
  kind?: string;
  title?: string;
  body?: string;
  /** posts: also reach those who asked to hear about this match. */
  matchId?: string | null;
  /** posts: only those who asked to hear about the match, not everyone who wants new posts. */
  onlyWatchers?: boolean;
  /** reminders: the players whose accounts get it. */
  playerIds?: string[];
};

/**
 * Sends a push notification to everyone on a team who has switched notifications on, or to some of them.
 * The caller's own login is used to ask the database for the targets, and the database
 * only answers coaches of that team.
 */
export async function POST(request: Request) {
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!privateKey) return Response.json({ sent: 0, error: 'VAPID_PRIVATE_KEY is not set' }, { status: 501 });

  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const body = (await request.json().catch(() => null)) as Body | null;
  if (!token || !body?.teamId || !body.kind || !KINDS.has(body.kind)) {
    return Response.json({ error: 'bad_request' }, { status: 400 });
  }

  const db = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: 'Bearer ' + token } },
  });
  const ask = async (fn: string, args: Record<string, unknown>) => {
    const { data, error } = await db.rpc(fn, args);
    if (error) throw new Error(error.message);
    return (data as Target[]) || [];
  };
  const lists: Promise<Target[]>[] = [];
  if (body.kind === 'reminders') {
    const ids = (body.playerIds || []).filter((x) => typeof x === 'string').slice(0, 200);
    if (!ids.length) return Response.json({ sent: 0 });
    lists.push(ask('notify_player_targets', { p_team: body.teamId, p_players: ids }));
  } else {
    if (!(body.kind === 'posts' && body.onlyWatchers)) lists.push(ask('notify_targets', { p_team: body.teamId, p_kind: body.kind }));
    // An older database without match wishes just sends to the rest.
    if (body.kind === 'posts' && body.matchId) lists.push(ask('notify_match_targets', { p_team: body.teamId, p_match: String(body.matchId) }).catch(() => []));
  }
  let targets: Target[];
  try {
    const seen = new Set<string>();
    targets = (await Promise.all(lists)).flat().filter((t) => !seen.has(t.endpoint) && !!seen.add(t.endpoint));
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'error' }, { status: 403 });
  }

  // The push services want a contact for the sender: the site's own https address works.
  const site = new URL(request.url);
  const subject = process.env.VAPID_SUBJECT || (site.protocol === 'https:' ? site.origin : 'mailto:push@' + site.hostname);
  try {
    webpush.setVapidDetails(subject, VAPID_PUBLIC_KEY, privateKey);
  } catch (e) {
    return Response.json({ sent: 0, error: String(e) }, { status: 500 });
  }
  const payload = JSON.stringify({
    title: String(body.title || 'InnerCircle').slice(0, 80),
    body: String(body.body || '').slice(0, 200),
    tag: body.kind,
    url: '/',
  });

  let sent = 0;
  await Promise.all(
    targets.map(async (t) => {
      try {
        await webpush.sendNotification({ endpoint: t.endpoint, keys: { p256dh: t.p256dh, auth: t.auth } }, payload, { TTL: 60 * 60 * 24 });
        sent++;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        // The phone unsubscribed or the browser data was cleared.
        if (status === 404 || status === 410) await db.rpc('delete_push', { p_endpoint: t.endpoint });
      }
    }),
  );
  return Response.json({ sent });
}
