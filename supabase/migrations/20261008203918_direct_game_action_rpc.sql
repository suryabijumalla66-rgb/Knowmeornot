-- Authenticated clients (including anonymous Supabase Auth users) can call the
-- game transaction directly. The caller identity is always taken from the
-- verified JWT; it can never be supplied or impersonated through the payload.
create or replace function public.game_action_client(action text,payload jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare caller uuid:=(select auth.uid());
begin
  if caller is null then raise exception 'authentication_required' using errcode='42501'; end if;
  return public.game_action(action,caller,payload);
end $$;

revoke all on function public.game_action_client(text,jsonb) from public,anon;
grant execute on function public.game_action_client(text,jsonb) to authenticated;
