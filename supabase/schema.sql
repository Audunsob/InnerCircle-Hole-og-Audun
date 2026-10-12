-- InnerCircle database setup, version 5 (accounts, approval of players and parents, list of coaches,
-- team name and codes, reports, notifications for one match or some players,
-- leaving a team, deleting your account and deleting files, removing coaches and deleting a team).
-- Paste all of this into Supabase: SQL Editor -> New query -> Run.
-- Safe to run more than once, and safe to run on top of version 1, 2, 3 and 4.

create extension if not exists pgcrypto;

-- ---------- Tables ----------

-- One row per team. The team's content (players, posts, matches, subscribers, …)
-- is stored as one JSON document, the same shape the app uses.
create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  team_code text not null unique,
  coach_code text not null unique,
  data jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Who belongs to which team, and as what. A code is only needed to join;
-- after that, access is checked against the signed-in account.
create table if not exists public.team_members (
  team_id uuid not null references public.teams (id) on delete cascade,
  user_id uuid not null,
  role text not null check (role in ('coach', 'player', 'parent', 'sub')),
  player_id text,
  -- Players and parents wait for a coach to approve them before they see anything.
  status text not null default 'active' check (status in ('pending', 'active')),
  created_at timestamptz not null default now(),
  primary key (team_id, user_id, role)
);
-- Version 2 had no status column.
alter table public.team_members add column if not exists status text not null default 'active';
do $$ begin
  alter table public.team_members add constraint team_members_status_check check (status in ('pending', 'active'));
exception when duplicate_object then null; end $$;
create index if not exists team_members_player_idx on public.team_members (team_id, player_id) where player_id is not null;

-- Phones and browsers that want push notifications.
create table if not exists public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null,
  team_id uuid not null references public.teams (id) on delete cascade,
  p256dh text not null,
  auth_key text not null,
  prefs jsonb not null default '{"posts": true, "matches": true, "results": true}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_team_id_idx on public.push_subscriptions (team_id);

-- Nobody reads these tables directly. Everything goes through the functions below.
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.push_subscriptions enable row level security;
revoke all on public.teams from anon, authenticated;
revoke all on public.team_members from anon, authenticated;
revoke all on public.push_subscriptions from anon, authenticated;

-- Version 1 functions took a code instead of an account. Remove them.
drop function if exists public.create_team(text, text, text, jsonb);
drop function if exists public.join_team(text);
drop function if exists public.team_version(text);
drop function if exists public.save_team(text, integer, jsonb);
drop function if exists public.ic_insert_team(text, text, text, jsonb);
drop function if exists public.ic_payload(public.teams, text);

-- ---------- Helpers ----------

create or replace function public.ic_norm(p text) returns text
language sql immutable set search_path = public as $$ select upper(regexp_replace(coalesce(p, ''), '\s', '', 'g')) $$;

-- The signed-in account. Fails if nobody is signed in.
create or replace function public.ic_uid() returns uuid
language plpgsql stable set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  return auth.uid();
end $$;

-- Approved members only: someone waiting for a coach's approval is not a member yet.
create or replace function public.ic_member(p_team uuid, p_role text) returns public.team_members
language sql stable security definer set search_path = public as $$
  select m from team_members m where m.team_id = p_team and m.user_id = auth.uid() and m.role = p_role and m.status = 'active'
$$;

-- Used by the photo storage rules: is the signed-in account on the team whose folder this is?
create or replace function public.ic_is_member(p_folder text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from team_members m where m.team_id::text = p_folder and m.user_id = auth.uid() and m.status = 'active')
$$;

-- Used by the photo storage rules: is the signed-in account a coach on the team whose folder this is?
create or replace function public.ic_is_coach(p_folder text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from team_members m where m.team_id::text = p_folder and m.user_id = auth.uid() and m.role = 'coach' and m.status = 'active')
$$;

-- Removes array items whose text equals p_value.
create or replace function public.ic_without(p_arr jsonb, p_value text) returns jsonb
language sql immutable set search_path = public as $$
  select coalesce(jsonb_agg(x), '[]'::jsonb) from jsonb_array_elements(coalesce(p_arr, '[]'::jsonb)) x where x #>> '{}' <> p_value
$$;

-- What a member gets back. Coaches see everything; others don't see the coach code,
-- payout account, coach signatures or other people's payments.
create or replace function public.ic_payload(t public.teams, p_role text) returns jsonb
language sql stable set search_path = public as $$
  select jsonb_build_object(
    'teamId', t.id,
    'role', p_role,
    'version', t.version,
    'data',
      case when p_role = 'coach' then
        t.data || jsonb_build_object('teamName', t.name, 'teamCode', t.team_code, 'coachCode', t.coach_code)
      else
        (t.data - 'payout' - 'coachConsents')
        || jsonb_build_object(
          'teamName', t.name,
          'teamCode', t.team_code,
          'payments', coalesce((
            select jsonb_agg(x) from jsonb_array_elements(coalesce(t.data -> 'payments', '[]'::jsonb)) x
            where x ->> 'subId' in ('sub-' || auth.uid()::text, 'par-' || auth.uid()::text)
          ), '[]'::jsonb),
          -- Reports and messages to the coaches: only your own.
          'reports', coalesce((
            select jsonb_agg(x) from jsonb_array_elements(coalesce(t.data -> 'reports', '[]'::jsonb)) x
            where x ->> 'by' = auth.uid()::text
          ), '[]'::jsonb))
      end
  )
$$;

-- ---------- Joining ----------

-- What someone sees after typing a code, before joining: team name and player names.
create or replace function public.peek_team(p_code text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  c text := ic_norm(p_code);
  t teams;
begin
  perform ic_uid();
  t := (select x from teams x where x.coach_code = c or x.team_code = c limit 1);
  if t.id is null then return null; end if;
  return jsonb_build_object(
    'teamId', t.id,
    'teamName', t.name,
    'isCoachCode', t.coach_code = c,
    'players', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p ->> 'id',
        'name', p ->> 'name',
        -- Linked to another account as the player. The sign-up shows it so a player can tell the coach.
        'taken', exists (
          select 1 from team_members m
          where m.team_id = t.id and m.role = 'player' and m.player_id = p ->> 'id' and m.user_id <> auth.uid()
        )))
      from jsonb_array_elements(coalesce(t.data -> 'players', '[]'::jsonb)) p
    ), '[]'::jsonb)
  );
end $$;

-- Joins a team. Coaches need the coach code; everyone else uses the team code.
-- A player can be linked to one account, and to at most two parents. Players and parents
-- wait for a coach to approve them; until then this returns {pending: true} instead of the team.
create or replace function public.join_team(p_code text, p_role text, p_player_id text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  c text := ic_norm(p_code);
  uid uuid := ic_uid();
  t teams;
  m team_members;
begin
  if p_role not in ('coach', 'player', 'parent', 'sub') then raise exception 'invalid_role'; end if;
  if p_role = 'coach' then
    t := (select x from teams x where x.coach_code = c);
  else
    t := (select x from teams x where x.team_code = c or x.coach_code = c);
  end if;
  if t.id is null then return null; end if;
  if p_role in ('player', 'parent') and not exists (
    select 1 from jsonb_array_elements(coalesce(t.data -> 'players', '[]'::jsonb)) p where p ->> 'id' = p_player_id
  ) then
    raise exception 'unknown_player';
  end if;
  if p_role = 'player' and exists (
    select 1 from team_members x
    where x.team_id = t.id and x.role = 'player' and x.player_id = p_player_id and x.user_id <> uid
  ) then
    raise exception 'player_taken';
  end if;
  if p_role = 'parent' and (
    select count(*) from team_members x
    where x.team_id = t.id and x.role = 'parent' and x.player_id = p_player_id and x.user_id <> uid
  ) >= 2 then
    raise exception 'parent_limit';
  end if;
  -- Picking another player (or child) than before starts a new approval.
  insert into team_members (team_id, user_id, role, player_id, status)
  values (t.id, uid, p_role, case when p_role in ('player', 'parent') then p_player_id end,
          case when p_role in ('player', 'parent') then 'pending' else 'active' end)
  on conflict (team_id, user_id, role) do update
    set player_id = excluded.player_id,
        status = case when team_members.player_id is not distinct from excluded.player_id
                      then team_members.status else excluded.status end
  returning * into m;
  if m.status = 'pending' then
    return jsonb_build_object('pending', true, 'teamId', t.id, 'teamName', t.name, 'role', p_role);
  end if;
  return ic_payload(t, p_role);
end $$;

create or replace function public.create_team(p_name text, p_coach_code text, p_team_code text, p_data jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  cc text := ic_norm(p_coach_code);
  tc text := ic_norm(p_team_code);
  uid uuid := ic_uid();
  new_id uuid := gen_random_uuid();
begin
  if length(cc) < 4 or length(tc) < 4 or cc = tc then raise exception 'invalid_codes'; end if;
  if exists (select 1 from teams where team_code in (cc, tc) or coach_code in (cc, tc)) then
    raise exception 'code_taken';
  end if;
  insert into teams (id, name, team_code, coach_code, data)
  values (new_id, trim(p_name), tc, cc, coalesce(p_data, '{}'::jsonb) - 'coachCode' - 'teamCode' - 'teamName');
  insert into team_members (team_id, user_id, role) values (new_id, uid, 'coach');
  return ic_payload((select x from teams x where x.id = new_id), 'coach');
end $$;

-- All teams and roles for the signed-in account, so login works on any device.
create or replace function public.my_teams() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'teamId', m.team_id, 'role', m.role, 'playerId', m.player_id, 'teamName', t.name, 'status', m.status)
    order by m.created_at desc), '[]'::jsonb)
  from team_members m join teams t on t.id = m.team_id
  where m.user_id = auth.uid()
$$;

-- ---------- Reading and saving ----------

create or replace function public.get_team(p_team uuid, p_role text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform ic_uid();
  if (ic_member(p_team, p_role)).team_id is null then raise exception 'not_member'; end if;
  return ic_payload((select x from teams x where x.id = p_team), p_role);
end $$;

create or replace function public.team_version(p_team uuid) returns integer
language sql stable security definer set search_path = public as $$
  select t.version from teams t
  where t.id = p_team and exists (select 1 from team_members m where m.team_id = p_team and m.user_id = auth.uid() and m.status = 'active')
$$;

-- Saves a new version of the team document.
-- Coaches may change everything. Everyone else may only change their own things:
-- their own hearts, their own player's consent (or their child's), their own subscription and payments,
-- and their own reports to the coaches.
-- Returns ok=false with the current document if someone else saved first.
create or replace function public.save_team(p_team uuid, p_role text, p_version integer, p_data jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid text := ic_uid()::text;
  m team_members;
  t teams;
  prev jsonb;
  merged jsonb;
  own text[];
begin
  m := ic_member(p_team, p_role);
  if m.team_id is null then raise exception 'not_member'; end if;
  t := (select x from teams x where x.id = p_team for update);
  if t.version <> p_version then
    return ic_payload(t, p_role) || jsonb_build_object('ok', false);
  end if;

  if p_role = 'coach' then
    merged := coalesce(p_data, '{}'::jsonb) - 'coachCode' - 'teamCode' - 'teamName';
    -- A player removed from the list takes the accounts linked to them (player and parents) along.
    delete from team_members x
    where x.team_id = p_team and x.role in ('player', 'parent') and x.player_id is not null
      and not exists (
        select 1 from jsonb_array_elements(coalesce(merged -> 'players', '[]'::jsonb)) p where p ->> 'id' = x.player_id
      );
  else
    prev := t.data;
    merged := prev;
    own := array['sub-' || uid, 'par-' || uid];

    -- Hearts: only your own heart can be added or removed. A parent may untag their own child.
    merged := jsonb_set(merged, '{posts}', coalesce((
      select jsonb_agg(
        op.v
        || jsonb_build_object('likedBy',
             ic_without(op.v -> 'likedBy', uid)
             || case when np.v is not null and coalesce(np.v -> 'likedBy', '[]'::jsonb) @> to_jsonb(uid)
                     then jsonb_build_array(uid) else '[]'::jsonb end)
        || case when p_role = 'parent' and m.player_id is not null and np.v is not null
                     and not coalesce(np.v -> 'tagged', '[]'::jsonb) @> to_jsonb(m.player_id)
                then jsonb_build_object('tagged', ic_without(op.v -> 'tagged', m.player_id))
                else '{}'::jsonb end
        order by op.ord)
      from jsonb_array_elements(coalesce(prev -> 'posts', '[]'::jsonb)) with ordinality op(v, ord)
      left join jsonb_array_elements(coalesce(p_data -> 'posts', '[]'::jsonb)) np(v) on np.v ->> 'id' = op.v ->> 'id'
    ), '[]'::jsonb));

    -- Consent: only for your own player (or your child).
    merged := jsonb_set(merged, '{players}', coalesce((
      select jsonb_agg(
        case when op.v ->> 'id' = m.player_id and np.v is not null
             then op.v || coalesce((
               select jsonb_object_agg(e.key, e.value) from jsonb_each(np.v) e
               where e.key in ('consent', 'declined', 'selfLogin')), '{}'::jsonb)
             else op.v end
        order by op.ord)
      from jsonb_array_elements(coalesce(prev -> 'players', '[]'::jsonb)) with ordinality op(v, ord)
      left join jsonb_array_elements(coalesce(p_data -> 'players', '[]'::jsonb)) np(v) on np.v ->> 'id' = op.v ->> 'id'
    ), '[]'::jsonb));

    -- Subscriptions and payments: only your own.
    merged := jsonb_set(merged, '{subs}',
      coalesce((select jsonb_agg(x) from jsonb_array_elements(coalesce(prev -> 'subs', '[]'::jsonb)) x where not (x ->> 'id' = any (own))), '[]'::jsonb)
      || coalesce((select jsonb_agg(x) from jsonb_array_elements(coalesce(p_data -> 'subs', '[]'::jsonb)) x where x ->> 'id' = any (own)), '[]'::jsonb));
    merged := jsonb_set(merged, '{payments}',
      coalesce((select jsonb_agg(x) from jsonb_array_elements(coalesce(prev -> 'payments', '[]'::jsonb)) x where not (x ->> 'subId' = any (own))), '[]'::jsonb)
      || coalesce((select jsonb_agg(x) from jsonb_array_elements(coalesce(p_data -> 'payments', '[]'::jsonb)) x where x ->> 'subId' = any (own)), '[]'::jsonb));

    -- Reports about a post, and messages to the coaches: only your own, at most 20 at a time.
    merged := jsonb_set(merged, '{reports}',
      coalesce((select jsonb_agg(x) from jsonb_array_elements(coalesce(prev -> 'reports', '[]'::jsonb)) x where x ->> 'by' is distinct from uid), '[]'::jsonb)
      || coalesce((select jsonb_agg(x) from (
           select x from jsonb_array_elements(coalesce(p_data -> 'reports', '[]'::jsonb)) x where x ->> 'by' = uid limit 20
         ) r(x)), '[]'::jsonb));
  end if;

  update teams set data = merged, version = version + 1, updated_at = now() where id = p_team;
  return ic_payload((select x from teams x where x.id = p_team), p_role) || jsonb_build_object('ok', true);
end $$;

-- ---------- Push notifications ----------

create or replace function public.save_push(p_team uuid, p_endpoint text, p_p256dh text, p_auth text, p_prefs jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := ic_uid();
begin
  if not exists (select 1 from team_members m where m.team_id = p_team and m.user_id = uid and m.status = 'active') then
    raise exception 'not_member';
  end if;
  insert into push_subscriptions (endpoint, user_id, team_id, p256dh, auth_key, prefs)
  values (p_endpoint, uid, p_team, p_p256dh, p_auth, coalesce(p_prefs, '{"posts": true, "matches": true, "results": true}'::jsonb))
  on conflict (endpoint) do update
    set user_id = excluded.user_id, team_id = excluded.team_id, p256dh = excluded.p256dh,
        auth_key = excluded.auth_key, prefs = excluded.prefs;
end $$;

-- Anyone holding an endpoint may remove it (it is unguessable). Used when a phone turns
-- notifications off and when the push service says the subscription is gone.
create or replace function public.delete_push(p_endpoint text) returns void
language sql security definer set search_path = public as $$
  delete from push_subscriptions where endpoint = p_endpoint
$$;

-- Where to send a notification. Only coaches may ask, and never get their own devices back.
create or replace function public.notify_targets(p_team uuid, p_kind text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  uid uuid := ic_uid();
begin
  if (ic_member(p_team, 'coach')).team_id is null then raise exception 'not_coach'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth_key))
    from push_subscriptions s
    where s.team_id = p_team and s.user_id <> uid and coalesce((s.prefs ->> p_kind)::boolean, true)
  ), '[]'::jsonb);
end $$;

-- ---------- Approving players and parents ----------

-- The accounts linked to players on the team, waiting or approved, with their email. Coaches only.
create or replace function public.team_links(p_team uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform ic_uid();
  if (ic_member(p_team, 'coach')).team_id is null then raise exception 'not_coach'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'userId', m.user_id, 'role', m.role, 'playerId', m.player_id, 'status', m.status,
      'email', u.email, 'at', m.created_at) order by m.created_at)
    from team_members m left join auth.users u on u.id = m.user_id
    where m.team_id = p_team and m.role in ('player', 'parent')
  ), '[]'::jsonb);
end $$;

-- Approves a waiting player or parent, or removes the link (rejecting a request, or unlinking
-- someone who picked the wrong player). Coaches only.
create or replace function public.decide_link(p_team uuid, p_user uuid, p_role text, p_approve boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform ic_uid();
  if (ic_member(p_team, 'coach')).team_id is null then raise exception 'not_coach'; end if;
  if p_role not in ('player', 'parent') then raise exception 'invalid_role'; end if;
  if p_approve then
    update team_members set status = 'active' where team_id = p_team and user_id = p_user and role = p_role;
  else
    delete from team_members where team_id = p_team and user_id = p_user and role = p_role;
    delete from push_subscriptions s where s.team_id = p_team and s.user_id = p_user
      and not exists (select 1 from team_members x where x.team_id = p_team and x.user_id = p_user);
  end if;
end $$;

-- ---------- Coaches ----------

-- Everyone who is a coach on the team, with email, when they joined, and the name and time
-- from the coach rules they signed (matched on email). Coaches only.
create or replace function public.team_coaches(p_team uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  t teams;
begin
  perform ic_uid();
  if (ic_member(p_team, 'coach')).team_id is null then raise exception 'not_coach'; end if;
  t := (select x from teams x where x.id = p_team);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'userId', m.user_id, 'email', u.email, 'at', m.created_at, 'me', m.user_id = auth.uid(),
      'name', c ->> 'name', 'signedAt', (c ->> 'at')::bigint) order by m.created_at)
    from team_members m
    left join auth.users u on u.id = m.user_id
    left join lateral (
      select x from jsonb_array_elements(coalesce(t.data -> 'coachConsents', '[]'::jsonb)) x
      where u.email is not null and lower(x ->> 'contact') = lower(u.email)
      order by (x ->> 'at')::bigint desc nulls last limit 1
    ) cc(c) on true
    where m.team_id = p_team and m.role = 'coach' and m.status = 'active'
  ), '[]'::jsonb);
end $$;

-- ---------- Team name and codes ----------

-- Renames the team and/or replaces its codes (for example when a code has leaked). Coaches only.
-- Members keep their access: a code is only needed to join.
create or replace function public.update_team(p_team uuid, p_name text, p_team_code text, p_coach_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  n text := trim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
  tc text := ic_norm(p_team_code);
  cc text := ic_norm(p_coach_code);
begin
  perform ic_uid();
  if (ic_member(p_team, 'coach')).team_id is null then raise exception 'not_coach'; end if;
  if length(n) < 2 or length(cc) < 4 or length(tc) < 4 or cc = tc then raise exception 'invalid_codes'; end if;
  if exists (select 1 from teams where id <> p_team and (team_code in (cc, tc) or coach_code in (cc, tc))) then
    raise exception 'code_taken';
  end if;
  update teams set name = n, team_code = tc, coach_code = cc, version = version + 1, updated_at = now() where id = p_team;
  return ic_payload((select x from teams x where x.id = p_team), 'coach') || jsonb_build_object('ok', true);
end $$;

-- ---------- Notifications to some of the team ----------

-- Devices that asked to hear when photos from one match are posted. Coaches only.
create or replace function public.notify_match_targets(p_team uuid, p_match text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  uid uuid := ic_uid();
begin
  if (ic_member(p_team, 'coach')).team_id is null then raise exception 'not_coach'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth_key))
    from push_subscriptions s
    where s.team_id = p_team and s.user_id <> uid and coalesce(s.prefs -> 'matchIds', '[]'::jsonb) @> to_jsonb(p_match)
  ), '[]'::jsonb);
end $$;

-- Devices of the accounts linked to some players (the player and their parents), e.g. for a
-- reminder about the consent form. Coaches only.
create or replace function public.notify_player_targets(p_team uuid, p_players text[]) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  uid uuid := ic_uid();
begin
  if (ic_member(p_team, 'coach')).team_id is null then raise exception 'not_coach'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth_key))
    from push_subscriptions s
    where s.team_id = p_team and s.user_id <> uid and exists (
      select 1 from team_members m
      where m.team_id = p_team and m.user_id = s.user_id and m.role in ('player', 'parent')
        and m.status = 'active' and m.player_id = any (p_players)
    )
  ), '[]'::jsonb);
end $$;

-- ---------- Leaving and deleting your account ----------

-- Removes an account's own things from a team document: its hearts and its subscription.
-- Payments stay, since the team needs them for its accounts.
create or replace function public.ic_forget(p_data jsonb, p_uid text) returns jsonb
language sql immutable set search_path = public as $$
  select p_data
    || jsonb_build_object('posts', coalesce((
      select jsonb_agg(p || jsonb_build_object('likedBy', ic_without(p -> 'likedBy', p_uid)) order by ord)
      from jsonb_array_elements(coalesce(p_data -> 'posts', '[]'::jsonb)) with ordinality x(p, ord)
    ), '[]'::jsonb))
    || jsonb_build_object('subs', coalesce((
      select jsonb_agg(x) from jsonb_array_elements(coalesce(p_data -> 'subs', '[]'::jsonb)) x
      where not (x ->> 'id' in ('sub-' || p_uid, 'par-' || p_uid))
    ), '[]'::jsonb))
$$;

-- Is the account the only coach on the team? Then the team would be left without anyone to run it.
create or replace function public.ic_last_coach(p_team uuid, p_uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from team_members m where m.team_id = p_team and m.user_id = p_uid and m.role = 'coach')
    and not exists (select 1 from team_members m where m.team_id = p_team and m.user_id <> p_uid and m.role = 'coach' and m.status = 'active')
$$;

-- Leaves a team in one role (or withdraws a request that is waiting for approval).
-- The only coach can't leave; someone else has to log in with the coach code first.
create or replace function public.leave_team(p_team uuid, p_role text) returns void
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := ic_uid();
begin
  if not exists (select 1 from team_members m where m.team_id = p_team and m.user_id = uid and m.role = p_role) then
    raise exception 'not_member';
  end if;
  if p_role = 'coach' and ic_last_coach(p_team, uid) then raise exception 'last_coach'; end if;
  delete from team_members where team_id = p_team and user_id = uid and role = p_role;
  if not exists (select 1 from team_members m where m.team_id = p_team and m.user_id = uid) then
    delete from push_subscriptions where team_id = p_team and user_id = uid;
    update teams set data = ic_forget(data, uid::text), version = version + 1, updated_at = now() where id = p_team;
  end if;
end $$;

-- Deletes the signed-in account: its memberships, hearts, subscriptions, phones and the login itself.
-- Not allowed while the account is the only coach on a team; the error names that team.
create or replace function public.delete_me() returns void
language plpgsql security definer set search_path = public, auth as $$
declare
  uid uuid := ic_uid();
  lone text;
begin
  select t.name into lone from team_members m join teams t on t.id = m.team_id
  where m.user_id = uid and m.role = 'coach' and ic_last_coach(m.team_id, uid) limit 1;
  if lone is not null then raise exception 'last_coach:%', lone; end if;
  update teams set data = ic_forget(data, uid::text), version = version + 1, updated_at = now()
  where id in (select m.team_id from team_members m where m.user_id = uid);
  delete from push_subscriptions where user_id = uid;
  delete from team_members where user_id = uid;
  delete from auth.users where id = uid;
end $$;

-- ---------- Running the team ----------

-- Removes another coach from the team. Any coach may do it; to remove yourself, leave the team.
create or replace function public.remove_coach(p_team uuid, p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := ic_uid();
begin
  if (ic_member(p_team, 'coach')).team_id is null then raise exception 'not_coach'; end if;
  if p_user = uid then raise exception 'use_leave'; end if;
  delete from team_members where team_id = p_team and user_id = p_user and role = 'coach';
  delete from push_subscriptions s where s.team_id = p_team and s.user_id = p_user
    and not exists (select 1 from team_members x where x.team_id = p_team and x.user_id = p_user);
end $$;

-- Deletes the team with everything in it: members, posts, matches and phones. Any coach may do it,
-- but must type the team's name. The app deletes the team's files first, while it still may.
create or replace function public.delete_team(p_team uuid, p_confirm text) returns void
language plpgsql security definer set search_path = public as $$
declare
  t teams;
begin
  perform ic_uid();
  if (ic_member(p_team, 'coach')).team_id is null then raise exception 'not_coach'; end if;
  t := (select x from teams x where x.id = p_team);
  if lower(trim(coalesce(p_confirm, ''))) <> lower(trim(t.name)) then raise exception 'wrong_name'; end if;
  delete from teams where id = p_team;
end $$;

-- ---------- Who may call what ----------

revoke all on function public.ic_member(uuid, text) from public, anon, authenticated;
-- Internal helpers, only called from the functions above.
revoke all on function public.ic_norm(text) from public, anon, authenticated;
revoke all on function public.ic_uid() from public, anon, authenticated;
revoke all on function public.ic_without(jsonb, text) from public, anon, authenticated;
revoke all on function public.ic_payload(public.teams, text) from public, anon, authenticated;
revoke all on function public.ic_forget(jsonb, text) from public, anon, authenticated;
revoke all on function public.ic_last_coach(uuid, uuid) from public, anon, authenticated;
revoke all on function public.ic_is_member(text) from public, anon;
revoke all on function public.ic_is_coach(text) from public, anon;
revoke all on function public.leave_team(uuid, text) from public, anon;
revoke all on function public.delete_me() from public, anon;
revoke all on function public.remove_coach(uuid, uuid) from public, anon;
revoke all on function public.delete_team(uuid, text) from public, anon;
grant execute on function public.remove_coach(uuid, uuid) to authenticated;
grant execute on function public.delete_team(uuid, text) to authenticated;
revoke all on function public.peek_team(text) from public, anon;
revoke all on function public.join_team(text, text, text) from public, anon;
revoke all on function public.create_team(text, text, text, jsonb) from public, anon;
revoke all on function public.my_teams() from public, anon;
revoke all on function public.get_team(uuid, text) from public, anon;
revoke all on function public.team_version(uuid) from public, anon;
revoke all on function public.save_team(uuid, text, integer, jsonb) from public, anon;
revoke all on function public.save_push(uuid, text, text, text, jsonb) from public, anon;
revoke all on function public.notify_targets(uuid, text) from public, anon;
revoke all on function public.team_links(uuid) from public, anon;
revoke all on function public.decide_link(uuid, uuid, text, boolean) from public, anon;
revoke all on function public.team_coaches(uuid) from public, anon;
revoke all on function public.update_team(uuid, text, text, text) from public, anon;
revoke all on function public.notify_match_targets(uuid, text) from public, anon;
revoke all on function public.notify_player_targets(uuid, text[]) from public, anon;
grant execute on function public.update_team(uuid, text, text, text) to authenticated;
grant execute on function public.notify_match_targets(uuid, text) to authenticated;
grant execute on function public.notify_player_targets(uuid, text[]) to authenticated;
grant execute on function public.team_links(uuid) to authenticated;
grant execute on function public.decide_link(uuid, uuid, text, boolean) to authenticated;
grant execute on function public.team_coaches(uuid) to authenticated;
grant execute on function public.peek_team(text) to authenticated;
grant execute on function public.join_team(text, text, text) to authenticated;
grant execute on function public.create_team(text, text, text, jsonb) to authenticated;
grant execute on function public.my_teams() to authenticated;
grant execute on function public.get_team(uuid, text) to authenticated;
grant execute on function public.team_version(uuid) to authenticated;
grant execute on function public.save_team(uuid, text, integer, jsonb) to authenticated;
grant execute on function public.save_push(uuid, text, text, text, jsonb) to authenticated;
grant execute on function public.notify_targets(uuid, text) to authenticated;
grant execute on function public.delete_push(text) to anon, authenticated;
grant execute on function public.ic_is_member(text) to authenticated;
grant execute on function public.ic_is_coach(text) to authenticated;
grant execute on function public.leave_team(uuid, text) to authenticated;
grant execute on function public.delete_me() to authenticated;

-- ---------- Photos, videos and signatures ----------
-- Private: only members of a team can upload to or open files in that team's folder,
-- and only the team's coaches can delete them (when a post or a photo in it is deleted).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', false, 52428800, array['image/jpeg', 'image/png', 'video/mp4', 'video/quicktime', 'video/webm'])
on conflict (id) do update set public = false, file_size_limit = 52428800,
  allowed_mime_types = array['image/jpeg', 'image/png', 'video/mp4', 'video/quicktime', 'video/webm'];

drop policy if exists "InnerCircle upload media" on storage.objects;
drop policy if exists "InnerCircle members upload" on storage.objects;
drop policy if exists "InnerCircle members read" on storage.objects;
drop policy if exists "InnerCircle coaches delete" on storage.objects;
create policy "InnerCircle members upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'media' and public.ic_is_member((storage.foldername(name))[1]));
create policy "InnerCircle members read" on storage.objects
  for select to authenticated
  using (bucket_id = 'media' and public.ic_is_member((storage.foldername(name))[1]));
create policy "InnerCircle coaches delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'media' and public.ic_is_coach((storage.foldername(name))[1]));
