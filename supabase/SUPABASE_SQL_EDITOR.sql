-- KNOW ME OR NOT? Complete Supabase backend
-- Paste this entire file into a new project's SQL Editor and click Run once.
-- Enable Anonymous Sign-Ins separately in Authentication settings.
create extension if not exists pgcrypto;

create type public.room_status as enum ('waiting','starting','question_active','reveal','intermission','finished','abandoned');
create type public.round_status as enum ('pending','active','revealed','skipped');

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  host_user_id uuid not null references auth.users(id),
  status public.room_status not null default 'waiting',
  max_players smallint not null default 8 check (max_players between 2 and 8),
  questions_per_player smallint not null default 2 check (questions_per_player between 1 and 5),
  round_seconds smallint not null default 15 check (round_seconds in (10,15,20,30)),
  category text not null default 'Mixed' check (char_length(category) between 1 and 40),
  version bigint not null default 0,
  last_activity_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '6 hours',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.room_members (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms on delete cascade,
  user_id uuid not null references auth.users(id),
  display_name text not null check (char_length(display_name) between 1 and 24),
  avatar text not null check (char_length(avatar) between 1 and 16),
  is_ready boolean not null default false,
  is_connected boolean not null default true,
  score integer not null default 0 check (score >= 0),
  connection_id uuid not null default gen_random_uuid(),
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique(room_id,user_id), unique(room_id,display_name)
);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references auth.users(id) on delete cascade,
  category text not null check (char_length(category) between 1 and 40),
  question_type text not null default 'preference' check (question_type in ('preference','situation','personality','hypothetical','this_or_that')),
  prompt text not null check (char_length(prompt) between 10 and 240),
  options jsonb not null check (jsonb_typeof(options)='array' and jsonb_array_length(options)=4),
  is_curated boolean not null default false,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  check ((is_curated and owner_user_id is null) or (not is_curated and owner_user_id is not null))
);

create table public.games (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms on delete cascade,
  status public.room_status not null default 'starting',
  current_round integer not null default 0,
  total_rounds integer not null check (total_rounds between 2 and 40),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index one_open_game_per_room on public.games(room_id) where status not in ('finished','abandoned');

create table public.game_rounds (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games on delete cascade,
  room_id uuid not null references public.rooms on delete cascade,
  round_number integer not null,
  subject_member_id uuid not null references public.room_members,
  question_id uuid not null references public.questions,
  status public.round_status not null default 'pending',
  starts_at timestamptz,
  deadline_at timestamptz,
  revealed_at timestamptz,
  subject_option smallint check (subject_option between 0 and 3),
  finalized_at timestamptz,
  unique(game_id,round_number), unique(game_id,question_id)
);

create table public.round_answers (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.game_rounds on delete cascade,
  member_id uuid not null references public.room_members on delete cascade,
  selected_option smallint not null check (selected_option between 0 and 3),
  submitted_at timestamptz not null default clock_timestamp(),
  is_correct boolean,
  points_awarded smallint not null default 0 check (points_awarded in (0,100,125)),
  unique(round_id,member_id)
);

create table public.game_results (
  game_id uuid not null references public.games on delete cascade,
  member_id uuid not null references public.room_members on delete cascade,
  final_rank integer not null,
  score integer not null default 0,
  correct_predictions integer not null default 0,
  incorrect_predictions integer not null default 0,
  answered_questions integer not null default 0,
  primary key(game_id,member_id)
);

create table public.friendship_stats (
  game_id uuid not null references public.games on delete cascade,
  predictor_member_id uuid not null references public.room_members on delete cascade,
  subject_member_id uuid not null references public.room_members on delete cascade,
  correct_count integer not null default 0,
  sample_size integer not null default 0,
  primary key(game_id,predictor_member_id,subject_member_id),
  check (predictor_member_id <> subject_member_id)
);

create table public.api_rate_limits (
  user_id uuid not null,
  action text not null,
  window_start timestamptz not null,
  attempts integer not null default 1,
  primary key(user_id,action,window_start)
);

create index rooms_code_active_idx on public.rooms(code) where status not in ('finished','abandoned');
create index rooms_expiry_idx on public.rooms(expires_at) where status not in ('finished','abandoned');
create index members_room_idx on public.room_members(room_id);
create index members_presence_idx on public.room_members(room_id,is_connected,last_seen_at);
create index games_room_idx on public.games(room_id,created_at desc);
create index rounds_active_idx on public.game_rounds(status,deadline_at) where status='active';
create index rounds_game_number_idx on public.game_rounds(game_id,round_number);
create index answers_round_idx on public.round_answers(round_id);

alter table public.rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.questions enable row level security;
alter table public.games enable row level security;
alter table public.game_rounds enable row level security;
alter table public.round_answers enable row level security;
alter table public.game_results enable row level security;
alter table public.friendship_stats enable row level security;
alter table public.api_rate_limits enable row level security;

create policy curated_or_owned_questions on public.questions for select to authenticated
using ((is_curated and enabled) or owner_user_id=(select auth.uid()));
create policy manage_own_questions on public.questions for all to authenticated
using (owner_user_id=(select auth.uid()) and not is_curated)
with check (owner_user_id=(select auth.uid()) and not is_curated);

revoke all on public.rooms,public.room_members,public.games,public.game_rounds,public.round_answers,public.game_results,public.friendship_stats,public.api_rate_limits from anon,authenticated;
grant select on public.questions to authenticated;

create schema game_private;
revoke all on schema game_private from public,anon,authenticated;

create or replace function game_private.clean_name(value text) returns text language sql immutable as $$
  select left(regexp_replace(trim(value), '[[:cntrl:]<>]', '', 'g'), 24)
$$;

create or replace function game_private.room_code() returns text language plpgsql volatile as $$
declare alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; result text := '';
begin for i in 1..6 loop result := result || substr(alphabet, 1 + floor(random()*length(alphabet))::int, 1); end loop; return result; end $$;

create or replace function game_private.guard_rate(p_user uuid,p_action text,p_limit int,p_seconds int) returns void language plpgsql security definer set search_path='' as $$
declare bucket timestamptz := to_timestamp(floor(extract(epoch from clock_timestamp())/p_seconds)*p_seconds);
declare count_now int;
begin
  insert into public.api_rate_limits(user_id,action,window_start,attempts) values(p_user,p_action,bucket,1)
  on conflict(user_id,action,window_start) do update set attempts=public.api_rate_limits.attempts+1 returning attempts into count_now;
  if count_now > p_limit then raise exception 'rate_limited' using errcode='P0001'; end if;
end $$;

create or replace function game_private.assert_member(p_room uuid,p_user uuid) returns public.room_members language plpgsql security definer set search_path='' as $$
declare member public.room_members;
begin select * into member from public.room_members where room_id=p_room and user_id=p_user; if member.id is null then raise exception 'not_a_room_member' using errcode='42501'; end if; return member; end $$;

create or replace function game_private.snapshot(p_room uuid,p_user uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare member public.room_members; result jsonb; current_game public.games; current_round public.game_rounds;
begin
  member := game_private.assert_member(p_room,p_user);
  select * into current_game from public.games where room_id=p_room order by created_at desc limit 1;
  if current_game.id is not null then select * into current_round from public.game_rounds where game_id=current_game.id and round_number=current_game.current_round; end if;
  select jsonb_build_object(
    'room',jsonb_build_object('id',r.id,'code',r.code,'status',r.status,'maxPlayers',r.max_players,'questionsPerPlayer',r.questions_per_player,'roundSeconds',r.round_seconds,'category',r.category,'version',r.version,'isHost',r.host_user_id=p_user),
    'selfMemberId',member.id,
    'players',(select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'name',m.display_name,'avatar',m.avatar,'ready',m.is_ready,'connected',m.is_connected,'score',m.score,'isHost',m.user_id=r.host_user_id) order by m.joined_at),'[]'::jsonb) from public.room_members m where m.room_id=r.id),
    'game',case when current_game.id is null then null else jsonb_build_object('id',current_game.id,'status',current_game.status,'currentRound',current_game.current_round,'totalRounds',current_game.total_rounds) end,
    'round',case when current_round.id is null then null else jsonb_build_object(
      'id',current_round.id,'number',current_round.round_number,'status',current_round.status,'subjectMemberId',current_round.subject_member_id,
      'startsAt',current_round.starts_at,'deadlineAt',current_round.deadline_at,
      'question',(select jsonb_build_object('id',q.id,'text',replace(q.prompt,'{player_name}',s.display_name),'options',q.options,'category',q.category) from public.questions q join public.room_members s on s.id=current_round.subject_member_id where q.id=current_round.question_id),
      'answerCount',(select count(*) from public.round_answers a where a.round_id=current_round.id),
      'myAnswer',(select a.selected_option from public.round_answers a where a.round_id=current_round.id and a.member_id=member.id),
      'reveal',case when current_round.status in ('revealed','skipped') then jsonb_build_object('subjectOption',current_round.subject_option,'skipped',current_round.status='skipped','answers',(select coalesce(jsonb_agg(jsonb_build_object('memberId',a.member_id,'selectedOption',a.selected_option,'correct',a.is_correct,'points',a.points_awarded)),'[]'::jsonb) from public.round_answers a where a.round_id=current_round.id)) else null end
    ) end
  ) into result from public.rooms r where r.id=p_room;
  return result;
end $$;

create or replace function game_private.create_room(p_user uuid,p_name text,p_avatar text,p_max int,p_qpp int,p_seconds int,p_category text) returns jsonb language plpgsql security definer set search_path='' as $$
declare room public.rooms; clean text := game_private.clean_name(p_name); code text;
begin
  perform game_private.guard_rate(p_user,'create_room',5,3600);
  if char_length(clean)<1 or char_length(p_avatar)<1 or char_length(p_avatar)>16 then raise exception 'invalid_profile'; end if;
  for attempt in 1..20 loop code:=game_private.room_code(); begin insert into public.rooms(code,host_user_id,max_players,questions_per_player,round_seconds,category) values(code,p_user,p_max,p_qpp,p_seconds,left(trim(p_category),40)) returning * into room; exit; exception when unique_violation then null; end; end loop;
  if room.id is null then raise exception 'room_code_exhausted'; end if;
  insert into public.room_members(room_id,user_id,display_name,avatar,is_ready) values(room.id,p_user,clean,p_avatar,true);
  return game_private.snapshot(room.id,p_user);
end $$;

create or replace function game_private.join_room(p_user uuid,p_code text,p_name text,p_avatar text) returns jsonb language plpgsql security definer set search_path='' as $$
declare room public.rooms; clean text:=game_private.clean_name(p_name); existing public.room_members;
begin
  perform game_private.guard_rate(p_user,'join_room',20,3600);
  select * into room from public.rooms where code=upper(trim(p_code)) and status='waiting' and expires_at>now() for update;
  if room.id is null then raise exception 'room_unavailable'; end if;
  select * into existing from public.room_members where room_id=room.id and user_id=p_user;
  if existing.id is not null then update public.room_members set is_connected=true,last_seen_at=now(),connection_id=gen_random_uuid() where id=existing.id; return game_private.snapshot(room.id,p_user); end if;
  if (select count(*) from public.room_members where room_id=room.id)>=room.max_players then raise exception 'room_full'; end if;
  insert into public.room_members(room_id,user_id,display_name,avatar) values(room.id,p_user,clean,p_avatar);
  update public.rooms set version=version+1,last_activity_at=now(),updated_at=now() where id=room.id;
  return game_private.snapshot(room.id,p_user);
exception when unique_violation then raise exception 'display_name_taken'; end $$;

create or replace function game_private.set_ready(p_user uuid,p_room uuid,p_ready boolean) returns jsonb language plpgsql security definer set search_path='' as $$
begin perform game_private.assert_member(p_room,p_user); update public.room_members set is_ready=p_ready,is_connected=true,last_seen_at=now() where room_id=p_room and user_id=p_user; update public.rooms set version=version+1,last_activity_at=now() where id=p_room and status='waiting'; return game_private.snapshot(p_room,p_user); end $$;

create or replace function game_private.start_game(p_user uuid,p_room uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare room public.rooms; game public.games; total int; available int;
begin
  select * into room from public.rooms where id=p_room for update;
  if room.host_user_id<>p_user then raise exception 'host_only' using errcode='42501'; end if;
  if room.status<>'waiting' then raise exception 'game_already_started'; end if;
  if (select count(*) from public.room_members where room_id=p_room and is_connected and is_ready)<2 or exists(select 1 from public.room_members where room_id=p_room and (not is_connected or not is_ready)) then raise exception 'players_not_ready'; end if;
  total:=(select count(*)*room.questions_per_player from public.room_members where room_id=p_room);
  select count(*) into available from public.questions where enabled and (room.category='Mixed' or category=room.category);
  if available<total then select count(*) into available from public.questions where enabled; end if;
  if available<total then raise exception 'insufficient_questions'; end if;
  update public.rooms set status='starting',version=version+1,last_activity_at=now() where id=p_room;
  insert into public.games(room_id,total_rounds) values(p_room,total) returning * into game;
  with subjects as (
    select m.id member_id,pass, row_number() over(order by pass,random()) rn
    from generate_series(1,room.questions_per_player) pass cross join public.room_members m where m.room_id=p_room
  ), qs as (
    select q.id, row_number() over(order by random()) rn from public.questions q
    where q.enabled and (
      room.category='Mixed'
      or ((select count(*) from public.questions qc where qc.enabled and qc.category=room.category)>=total and q.category=room.category)
      or ((select count(*) from public.questions qc where qc.enabled and qc.category=room.category)<total)
    ) limit total
  )
  insert into public.game_rounds(game_id,room_id,round_number,subject_member_id,question_id)
  select game.id,p_room,s.rn,s.member_id,qs.id from subjects s join qs using(rn) order by s.rn;
  update public.games set status='question_active',current_round=1,started_at=clock_timestamp() where id=game.id;
  update public.game_rounds set status='active',starts_at=clock_timestamp(),deadline_at=clock_timestamp()+make_interval(secs=>room.round_seconds) where game_id=game.id and round_number=1;
  update public.rooms set status='question_active',version=version+1 where id=p_room;
  return game_private.snapshot(p_room,p_user);
end $$;

create or replace function game_private.finalize_round(p_round uuid) returns void language plpgsql security definer set search_path='' as $$
declare round public.game_rounds; game public.games; subject_answer smallint;
begin
  select * into round from public.game_rounds where id=p_round for update;
  if round.status<>'active' or round.finalized_at is not null then return; end if;
  select selected_option into subject_answer from public.round_answers where round_id=round.id and member_id=round.subject_member_id;
  if subject_answer is null then
    update public.game_rounds set status='skipped',revealed_at=clock_timestamp(),finalized_at=clock_timestamp() where id=round.id;
  else
    update public.round_answers a set is_correct=case when a.member_id=round.subject_member_id then null else a.selected_option=subject_answer end,
      points_awarded=case when a.member_id=round.subject_member_id or a.selected_option<>subject_answer then 0 when a.submitted_at<=round.starts_at+interval '5 seconds' then 125 else 100 end where a.round_id=round.id;
    update public.room_members m set score=m.score+x.points from (select member_id,points_awarded points from public.round_answers where round_id=round.id) x where m.id=x.member_id;
    update public.game_rounds set status='revealed',subject_option=subject_answer,revealed_at=clock_timestamp(),finalized_at=clock_timestamp() where id=round.id;
  end if;
  select * into game from public.games where id=round.game_id;
  update public.games set status='reveal' where id=game.id; update public.rooms set status='reveal',version=version+1,last_activity_at=now() where id=round.room_id;
end $$;

create or replace function game_private.submit_answer(p_user uuid,p_round uuid,p_option int) returns jsonb language plpgsql security definer set search_path='' as $$
declare round public.game_rounds; member public.room_members; required int; submitted int;
begin
  if p_option not between 0 and 3 then raise exception 'invalid_option'; end if;
  select * into round from public.game_rounds where id=p_round for update;
  if round.status<>'active' or clock_timestamp()>round.deadline_at then raise exception 'round_closed'; end if;
  member:=game_private.assert_member(round.room_id,p_user);
  insert into public.round_answers(round_id,member_id,selected_option) values(round.id,member.id,p_option);
  select count(*) into required from public.room_members where room_id=round.room_id;
  select count(*) into submitted from public.round_answers where round_id=round.id;
  if submitted>=required then perform game_private.finalize_round(round.id); end if;
  return game_private.snapshot(round.room_id,p_user);
exception when unique_violation then raise exception 'answer_already_submitted'; end $$;

create or replace function game_private.advance_game(p_user uuid,p_room uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare room public.rooms; game public.games; next_round int;
begin
  select * into room from public.rooms where id=p_room for update; if room.host_user_id<>p_user then raise exception 'host_only' using errcode='42501'; end if;
  select * into game from public.games where room_id=p_room and status in ('reveal','intermission') order by created_at desc limit 1 for update;
  if game.id is null then raise exception 'not_ready_to_advance'; end if;
  next_round:=game.current_round+1;
  if next_round>game.total_rounds then
    update public.games set status='finished',completed_at=clock_timestamp() where id=game.id;
    insert into public.game_results(game_id,member_id,final_rank,score,correct_predictions,incorrect_predictions,answered_questions)
    select game.id,m.id,rank() over(order by m.score desc,m.joined_at),m.score,count(*) filter(where a.is_correct),count(*) filter(where a.is_correct=false),count(a.id)
    from public.room_members m left join public.round_answers a on a.member_id=m.id where m.room_id=p_room group by m.id;
    insert into public.friendship_stats(game_id,predictor_member_id,subject_member_id,correct_count,sample_size)
    select game.id,a.member_id,gr.subject_member_id,count(*) filter(where a.is_correct),count(*) from public.round_answers a join public.game_rounds gr on gr.id=a.round_id where gr.game_id=game.id and a.member_id<>gr.subject_member_id group by a.member_id,gr.subject_member_id;
    update public.rooms set status='finished',version=version+1 where id=p_room;
  else
    update public.games set status='question_active',current_round=next_round where id=game.id;
    update public.game_rounds set status='active',starts_at=clock_timestamp(),deadline_at=clock_timestamp()+make_interval(secs=>room.round_seconds) where game_id=game.id and round_number=next_round;
    update public.rooms set status='question_active',version=version+1 where id=p_room;
  end if;
  return game_private.snapshot(p_room,p_user);
end $$;

create or replace function game_private.leave_room(p_user uuid,p_room uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare room public.rooms; next_host uuid;
begin
  select * into room from public.rooms where id=p_room for update; perform game_private.assert_member(p_room,p_user);
  if room.status='waiting' then delete from public.room_members where room_id=p_room and user_id=p_user; else update public.room_members set is_connected=false,last_seen_at=now() where room_id=p_room and user_id=p_user; end if;
  if room.host_user_id=p_user then select user_id into next_host from public.room_members where room_id=p_room and user_id<>p_user and is_connected order by joined_at limit 1; if next_host is null then update public.rooms set status='abandoned' where id=p_room; else update public.rooms set host_user_id=next_host,version=version+1 where id=p_room; end if; end if;
  return jsonb_build_object('left',true);
end $$;

create or replace function game_private.remove_player(p_user uuid,p_room uuid,p_member uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare room public.rooms; begin select * into room from public.rooms where id=p_room for update; if room.host_user_id<>p_user or room.status<>'waiting' then raise exception 'host_only' using errcode='42501'; end if; delete from public.room_members where id=p_member and room_id=p_room and user_id<>p_user; update public.rooms set version=version+1 where id=p_room; return game_private.snapshot(p_room,p_user); end $$;

create or replace function game_private.heartbeat(p_user uuid,p_room uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin perform game_private.assert_member(p_room,p_user); update public.room_members set is_connected=true,last_seen_at=now() where room_id=p_room and user_id=p_user; return game_private.snapshot(p_room,p_user); end $$;

create or replace function game_private.expire_rounds() returns int language plpgsql security definer set search_path='' as $$
declare item record; processed int:=0; begin for item in select id from public.game_rounds where status='active' and deadline_at<=clock_timestamp() for update skip locked loop perform game_private.finalize_round(item.id); processed:=processed+1; end loop; update public.rooms set status='abandoned' where status='waiting' and expires_at<now(); return processed; end $$;

create or replace function game_private.rematch(p_user uuid,p_room uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare room public.rooms; begin select * into room from public.rooms where id=p_room for update; if room.host_user_id<>p_user or room.status<>'finished' then raise exception 'host_only'; end if; update public.room_members set score=0,is_ready=(user_id=p_user) where room_id=p_room; update public.rooms set status='waiting',version=version+1,expires_at=now()+interval '6 hours' where id=p_room; return game_private.snapshot(p_room,p_user); end $$;

-- Edge Functions use only these service-role RPCs. They are deliberately not callable by browsers.
create or replace function public.game_action(action text,user_id uuid,payload jsonb default '{}'::jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
begin
  case action
    when 'create_room' then return game_private.create_room(user_id,payload->>'name',payload->>'avatar',coalesce((payload->>'maxPlayers')::int,8),coalesce((payload->>'questionsPerPlayer')::int,2),coalesce((payload->>'roundSeconds')::int,15),coalesce(payload->>'category','Mixed'));
    when 'join_room' then return game_private.join_room(user_id,payload->>'code',payload->>'name',payload->>'avatar');
    when 'snapshot' then perform game_private.expire_rounds(); return game_private.snapshot((payload->>'roomId')::uuid,user_id);
    when 'ready' then return game_private.set_ready(user_id,(payload->>'roomId')::uuid,(payload->>'ready')::boolean);
    when 'start' then return game_private.start_game(user_id,(payload->>'roomId')::uuid);
    when 'answer' then return game_private.submit_answer(user_id,(payload->>'roundId')::uuid,(payload->>'option')::int);
    when 'advance' then return game_private.advance_game(user_id,(payload->>'roomId')::uuid);
    when 'leave' then return game_private.leave_room(user_id,(payload->>'roomId')::uuid);
    when 'remove_player' then return game_private.remove_player(user_id,(payload->>'roomId')::uuid,(payload->>'memberId')::uuid);
    when 'heartbeat' then return game_private.heartbeat(user_id,(payload->>'roomId')::uuid);
    when 'rematch' then return game_private.rematch(user_id,(payload->>'roomId')::uuid);
    else raise exception 'unknown_action';
  end case;
end $$;
revoke all on function public.game_action(text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.game_action(text,uuid,jsonb) to service_role;

-- Low-latency browser RPC. Identity comes only from the verified Supabase JWT.
create or replace function public.game_action_client(action text,payload jsonb default '{}'::jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid:=(select auth.uid());
begin
  if caller is null then raise exception 'authentication_required' using errcode='42501'; end if;
  return public.game_action(action,caller,payload);
end $$;
revoke all on function public.game_action_client(text,jsonb) from public,anon;
grant execute on function public.game_action_client(text,jsonb) to authenticated;

create or replace function game_private.broadcast_room_change() returns trigger language plpgsql security definer set search_path='' as $$
declare room_id uuid; begin room_id:=case when TG_OP='DELETE' then old.room_id else new.room_id end; perform realtime.send(jsonb_build_object('roomId',room_id,'changedAt',clock_timestamp()),'state_changed','room:'||room_id::text||':game',true); return null; end $$;
create trigger members_broadcast after insert or update or delete on public.room_members for each row execute function game_private.broadcast_room_change();
create trigger rounds_broadcast after insert or update on public.game_rounds for each row execute function game_private.broadcast_room_change();

create policy room_members_receive_game_events on realtime.messages for select to authenticated using (
  realtime.topic() like 'room:%:game' and exists(select 1 from public.room_members m where m.room_id=split_part(realtime.topic(),':',2)::uuid and m.user_id=(select auth.uid()))
);
-- Clients only receive server broadcasts. They cannot publish gameplay events themselves.

grant usage on schema public to authenticated;
grant select,insert,update,delete on public.questions to authenticated;


-- ============================================================
-- SEED: 120 curated questions
-- ============================================================

with base(category,question_type,prompt,options) as (values
('Classic Preferences','preference','What would {player_name} choose as a dream gift?','["A surprise trip","The latest tech","Something handmade","A shopping spree"]'::jsonb),
('Classic Preferences','preference','What is {player_name}''s ideal way to recharge?','["A long nap","Time outdoors","A movie marathon","Meeting friends"]'::jsonb),
('Classic Preferences','preference','Which treat would {player_name} save for last?','["Chocolate cake","Spicy snacks","Ice cream","Fresh fruit"]'::jsonb),
('Classic Preferences','preference','Which view would {player_name} wake up to?','["Ocean waves","Mountain peaks","City lights","A quiet garden"]'::jsonb),
('Situational Questions','situation','If {player_name} won a free flight tonight, where would they go?','["A tropical island","A famous city","A mountain town","Wherever friends choose"]'::jsonb),
('Situational Questions','situation','If the power went out all evening, what would {player_name} do?','["Tell stories","Go for a walk","Sleep early","Find a board game"]'::jsonb),
('Situational Questions','situation','What would {player_name} rescue first from a very messy room?','["Their phone","A favorite outfit","Important documents","The snacks"]'::jsonb),
('Situational Questions','situation','If {player_name} became famous tomorrow, what would it be for?','["A creative talent","A brave idea","A funny moment","Helping people"]'::jsonb),
('Funny & Chaotic','hypothetical','Which harmless supervillain plan suits {player_name}?','["Ban early alarms","Replace rain with confetti","Make snacks free","Declare every Friday a holiday"]'::jsonb),
('Funny & Chaotic','hypothetical','Which animal would {player_name} trust as a personal assistant?','["A clever crow","A loyal dog","A calm capybara","A dramatic cat"]'::jsonb),
('Funny & Chaotic','hypothetical','What would {player_name} do first during a fake apocalypse?','["Raid the snack aisle","Build a blanket fort","Take a selfie","Create a team plan"]'::jsonb),
('Funny & Chaotic','hypothetical','Which weird contest could {player_name} secretly win?','["Fastest nap","Best excuse","Loudest laugh","Most tabs open"]'::jsonb),
('This or That','this_or_that','What would {player_name} pick for a spontaneous weekend?','["Road trip","Staycation","Festival","Nature escape"]'::jsonb),
('This or That','this_or_that','Which everyday luxury matters more to {player_name}?','["Fast Wi-Fi","Great coffee","Soft pillows","Zero traffic"]'::jsonb),
('This or That','this_or_that','Which power would {player_name} rather have?','["Teleportation","Mind reading","Time pause","Perfect memory"]'::jsonb),
('This or That','this_or_that','What schedule would {player_name} choose?','["Early bird","Night owl","Four-day week","No schedule at all"]'::jsonb),
('Friends','personality','What makes {player_name} feel most appreciated by friends?','["A thoughtful message","Quality time","Practical help","A surprise plan"]'::jsonb),
('Friends','personality','What role does {player_name} play in a group trip?','["The planner","The navigator","The entertainer","The snack manager"]'::jsonb),
('Friends','personality','What would {player_name} remember from a great party?','["The conversations","The music","The food","One hilarious moment"]'::jsonb),
('Friends','situation','How would {player_name} cheer up a friend?','["Listen quietly","Send memes","Plan an outing","Bring food"]'::jsonb),
('Couples','preference','Which date would {player_name} enjoy most?','["Cozy dinner","Adventure activity","Live show","Sunset walk"]'::jsonb),
('Couples','preference','Which small gesture would charm {player_name}?','["A favorite snack","A handwritten note","A planned surprise","A perfect playlist"]'::jsonb),
('Family','situation','What is {player_name} most likely to bring to a family gathering?','["A signature dish","A game","Family gossip","A last-minute excuse"]'::jsonb),
('Family','situation','Which family tradition would {player_name} happily lead?','["Holiday cooking","Photo day","Game night","Travel planning"]'::jsonb),
('Office','personality','What is {player_name} secretly best at during meetings?','["Finding solutions","Reading the room","Taking clear notes","Keeping everyone awake"]'::jsonb),
('Office','preference','Which desk upgrade would {player_name} choose?','["A standing desk","A coffee machine","A giant monitor","A cozy chair"]'::jsonb),
('Office','situation','How would {player_name} celebrate finishing a huge project?','["Team dinner","A day off","Quiet satisfaction","An elaborate victory dance"]'::jsonb),
('Office','personality','Which work message describes {player_name}?','["Already done","Quick question","Let''s simplify","Coffee first"]'::jsonb),
('Mixed','hypothetical','What would {player_name} buy first if money were no object?','["A dream home","A world tour","A luxury car","A creative studio"]'::jsonb),
('Mixed','personality','Which word best describes {player_name} on a good day?','["Curious","Reliable","Playful","Ambitious"]'::jsonb)
), twists(suffix) as (values(''),(' — decide instantly.'),(' — no overthinking.'),(' when nobody is judging?'))
insert into public.questions(category,question_type,prompt,options,is_curated,enabled)
select category,question_type,prompt||suffix,options,true,true from base cross join twists;

