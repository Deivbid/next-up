-- Run once after both library migrations. Existing libraries and web sessions are preserved.
begin;
create schema if not exists next_up_private;
revoke all on schema next_up_private from public, anon, authenticated;

create table public.mcp_connections (
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null,
  client_name text not null check (char_length(client_name) between 1 and 200),
  permission text not null check (permission in ('read', 'write')),
  resource text not null check (resource in (
    'https://next-up.deivbid.workers.dev/api/mcp', 'http://127.0.0.1:3030/api/mcp'
  )),
  generation uuid not null default gen_random_uuid(),
  granted_at timestamptz not null default now(),
  primary key (user_id, client_id)
);
alter table public.mcp_connections enable row level security;
revoke all on public.mcp_connections from public, anon, authenticated;
grant select on public.mcp_connections to authenticated;
create policy connections_web_owner on public.mcp_connections for select to authenticated
using (user_id = (select auth.uid()) and (select auth.jwt()->>'client_id') is null);

create function public.next_up_mcp_allowed(p_write boolean default false)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and (
    auth.jwt()->>'client_id' is null or exists (
      select 1 from public.mcp_connections c
      where c.user_id = auth.uid() and c.client_id::text = auth.jwt()->>'client_id'
        and c.generation::text = auth.jwt()->>'next_up_grant'
        and (not p_write or c.permission = 'write')
    )
  );
$$;
revoke all on function public.next_up_mcp_allowed(boolean) from public, anon;
grant execute on function public.next_up_mcp_allowed(boolean) to authenticated;

-- Close direct Data API reads too; an MCP token cannot bypass its grant using REST.
alter policy games_select_own on public.library_games
using (user_id = (select auth.uid()) and (select public.next_up_mcp_allowed(false)));
alter policy preferences_select_own on public.user_preferences
using (user_id = (select auth.uid()) and (select public.next_up_mcp_allowed(false)));

-- Keep the original operations in a non-exposed schema; thin public wrappers enforce grants.
alter function public.next_up_read_library() set schema next_up_private;
alter function public.next_up_change_library(bigint,jsonb,jsonb,uuid[],boolean) set schema next_up_private;
revoke all on function next_up_private.next_up_read_library() from public, anon, authenticated;
revoke all on function next_up_private.next_up_change_library(bigint,jsonb,jsonb,uuid[],boolean) from public, anon, authenticated;

create function public.next_up_read_library()
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not public.next_up_mcp_allowed(false) then
    raise exception using errcode = '42501', message = 'Library access not allowed';
  end if;
  return next_up_private.next_up_read_library();
end;
$$;
create function public.next_up_change_library(
  p_expected_revision bigint, p_games jsonb default '[]'::jsonb,
  p_preferences jsonb default null, p_remove uuid[] default '{}', p_replace boolean default false
) returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not public.next_up_mcp_allowed(true) then
    raise exception using errcode = '42501', message = 'Library editing not allowed';
  end if;
  if auth.jwt()->>'client_id' is not null and (
    p_replace is distinct from false or p_preferences is not null
    or jsonb_typeof(p_games) is distinct from 'array' or p_remove is null
    or jsonb_array_length(p_games) + cardinality(p_remove) <> 1
  ) then
    raise exception using errcode = '42501', message = 'Agents can only change one game at a time';
  end if;
  return next_up_private.next_up_change_library(p_expected_revision,p_games,p_preferences,p_remove,p_replace);
end;
$$;
revoke all on function public.next_up_read_library() from public, anon;
revoke all on function public.next_up_change_library(bigint,jsonb,jsonb,uuid[],boolean) from public, anon;
grant execute on function public.next_up_read_library(), public.next_up_change_library(bigint,jsonb,jsonb,uuid[],boolean) to authenticated;

-- Only a direct web login can create/revoke grants. OAuth clients cannot promote themselves.
create function public.next_up_set_mcp_connection(
  p_client_id uuid, p_client_name text, p_permission text, p_resource text
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or auth.jwt()->>'client_id' is not null then
    raise exception using errcode = '42501', message = 'Use Next Up to manage connections';
  end if;
  if p_permission is null then
    delete from public.mcp_connections where user_id = auth.uid() and client_id = p_client_id;
  else
    insert into public.mcp_connections(user_id,client_id,client_name,permission,resource)
    values(auth.uid(),p_client_id,p_client_name,p_permission,p_resource)
    on conflict(user_id,client_id) do update set client_name=excluded.client_name,
      permission=excluded.permission,resource=excluded.resource,generation=gen_random_uuid(),granted_at=now();
  end if;
end;
$$;
revoke all on function public.next_up_set_mcp_connection(uuid,text,text,text) from public, anon;
grant execute on function public.next_up_set_mcp_connection(uuid,text,text,text) to authenticated;

create function public.next_up_mcp_access()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare permission text;
begin
  if auth.jwt()->>'client_id' is null or not public.next_up_mcp_allowed(false) then
    raise exception using errcode = '42501', message = 'Authorize this connection in Next Up';
  end if;
  select c.permission into permission from public.mcp_connections c
  where c.user_id=auth.uid() and c.client_id::text=auth.jwt()->>'client_id';
  return jsonb_build_object('permission',permission);
end;
$$;
revoke all on function public.next_up_mcp_access() from public, anon;
grant execute on function public.next_up_mcp_access() to authenticated;

-- Enable this as Authentication > Hooks > Custom Access Token AFTER applying this file.
-- Web/Google sessions are returned unchanged. OAuth tokens need a live approved grant.
create function public.next_up_mcp_token_hook(event jsonb)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare claims jsonb := event->'claims'; connection public.mcp_connections;
begin
  if claims->>'client_id' is not null then
    select * into connection from public.mcp_connections c
    where c.user_id=(event->>'user_id')::uuid and c.client_id::text=claims->>'client_id';
    -- No grant => no MCP audience or generation, so access fails closed.
    claims := claims - 'next_up_grant';
    if connection.client_id is not null then
      claims := jsonb_set(claims,'{aud}',jsonb_build_array('authenticated',connection.resource));
      claims := jsonb_set(claims,'{next_up_grant}',to_jsonb(connection.generation::text));
    else
      claims := jsonb_set(claims,'{aud}','"authenticated"'::jsonb);
    end if;
  end if;
  return jsonb_build_object('claims',claims);
end;
$$;
revoke all on function public.next_up_mcp_token_hook(jsonb) from public, anon, authenticated;
grant usage on schema public to supabase_auth_admin;
grant execute on function public.next_up_mcp_token_hook(jsonb) to supabase_auth_admin;
commit;
