-- Run once, after 202609110001_library.sql. Preserves existing rows.
begin;

-- Single-statement snapshot keeps games and the library edit counter consistent.
create function public.next_up_read_library()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb; owner_id uuid := auth.uid();
begin
  if owner_id is null then raise exception using errcode = '42501', message = 'Sign in required'; end if;
  select jsonb_build_object(
    'games', coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
      'id', g.id, 'title', g.title, 'ownership', g.ownership, 'status', g.status,
      'devices', g.devices, 'genres', g.genres, 'session', g.session,
      'notes', g.notes, 'categories', g.categories, 'cover', g.cover,
      'steamId', g.steam_id, 'igdbId', g.igdb_id, 'updatedAt', g.updated_at
    )) order by g.id) from public.library_games g where g.user_id = owner_id), '[]'::jsonb),
    'preferences', coalesce((select jsonb_build_object('id', 'preferences', 'devices', p.devices, 'theme', p.theme)
      from public.user_preferences p where p.user_id = owner_id),
      '{"id":"preferences","devices":["PC","Steam Deck","PS5","Switch 2"],"theme":"dark"}'::jsonb),
    'revision', coalesce((select p.revision from public.user_preferences p where p.user_id = owner_id), 0)
  ) into result;
  return result;
end;
$$;

-- All writes use this transaction. The library counter prevents stale overwrites,
-- including retries after a response was lost. No automatic mutation retry needed.
create function public.next_up_change_library(
  p_expected_revision bigint,
  p_games jsonb default '[]'::jsonb,
  p_preferences jsonb default null,
  p_remove uuid[] default '{}',
  p_replace boolean default false
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare owner_id uuid := auth.uid(); current_revision bigint;
begin
  if owner_id is null then raise exception using errcode = '42501', message = 'Sign in required'; end if;
  perform pg_advisory_xact_lock(hashtextextended('next-up:' || owner_id::text, 0));
  select coalesce((select revision from public.user_preferences where user_id = owner_id), 0) into current_revision;
  if p_expected_revision is distinct from current_revision then
    raise exception using errcode = 'PT409', message = 'Library changed. Refresh before saving.';
  end if;
  if jsonb_typeof(p_games) is distinct from 'array' or jsonb_array_length(p_games) > 20000
    or octet_length(p_games::text) > 10485760 or p_remove is null or cardinality(p_remove) > 20000
    or p_replace is null then
    raise exception using errcode = '22023', message = 'Invalid library change';
  end if;
  if p_preferences is not null and (
    jsonb_typeof(p_preferences) is distinct from 'object'
    or p_preferences->>'id' is distinct from 'preferences'
    or jsonb_typeof(p_preferences->'devices') is distinct from 'array'
    or p_preferences->>'theme' is null
  ) then raise exception using errcode = '22023', message = 'Invalid preferences'; end if;

  if p_replace then delete from public.library_games where user_id = owner_id;
  else delete from public.library_games where user_id = owner_id and id = any(p_remove); end if;

  insert into public.library_games
    (user_id,id,title,ownership,status,devices,genres,session,notes,categories,cover,steam_id,igdb_id,updated_at)
  select owner_id,g.id,g.title,g.ownership,g.status,g.devices,g.genres,g.session,g.notes,g.categories,g.cover,g."steamId",g."igdbId",g."updatedAt"
  from jsonb_to_recordset(p_games) as g(id uuid,title text,ownership text,status text,devices text[],genres text[],session text,
    notes text,categories text[],cover text,"steamId" bigint,"igdbId" bigint,"updatedAt" bigint)
  on conflict (user_id,id) do update set title=excluded.title,ownership=excluded.ownership,status=excluded.status,
    devices=excluded.devices,genres=excluded.genres,session=excluded.session,notes=excluded.notes,
    categories=excluded.categories,cover=excluded.cover,steam_id=excluded.steam_id,igdb_id=excluded.igdb_id,updated_at=excluded.updated_at;

  if (select count(*) from public.library_games where user_id = owner_id) > 20000 then
    raise exception using errcode = '22023', message = 'Library limit reached';
  end if;
  -- Upsert always advances the library counter, even for a game-only change.
  insert into public.user_preferences (user_id,devices,theme)
  values (owner_id,
    case when p_preferences is not null then array(select jsonb_array_elements_text(p_preferences->'devices'))
      else coalesce((select devices from public.user_preferences where user_id=owner_id),array['PC','Steam Deck','PS5','Switch 2']::text[]) end,
    coalesce(p_preferences->>'theme',(select theme from public.user_preferences where user_id=owner_id),'dark'))
  on conflict (user_id) do update set devices=excluded.devices,theme=excluded.theme;
  return public.next_up_read_library();
end;
$$;

revoke all on function public.next_up_read_library() from public, anon, authenticated;
revoke all on function public.next_up_change_library(bigint,jsonb,jsonb,uuid[],boolean) from public, anon, authenticated;
grant execute on function public.next_up_read_library() to authenticated;
grant execute on function public.next_up_change_library(bigint,jsonb,jsonb,uuid[],boolean) to authenticated;
-- Direct writes would bypass the library-wide conflict check.
revoke insert,update,delete on public.library_games,public.user_preferences from authenticated;
commit;
