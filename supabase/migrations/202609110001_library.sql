-- Next Up: run once in the SQL Editor of the dedicated Next Up project.
-- Creates empty tables. Does not import, delete, or modify existing game data.
begin;

create table public.library_games (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id uuid not null,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  ownership text not null check (ownership in ('owned', 'wishlist')),
  status text not null check (status in ('Backlog', 'Playing', 'Paused', 'Finished', 'Dropped')),
  devices text[] not null default '{}' check (
    cardinality(devices) <= 4
    and devices <@ array['PC', 'Steam Deck', 'PS5', 'Switch 2']::text[]
    and array_position(devices, null) is null
  ),
  genres text[] not null default '{}' check (
    cardinality(genres) <= 10 and array_position(genres, null) is null
    and octet_length(genres::text) <= 4096
  ),
  session text not null check (session in ('unknown', 'short', 'long', 'flexible')),
  notes text not null default '' check (char_length(notes) <= 4000),
  categories text[] not null default '{}' check (
    cardinality(categories) <= 20 and array_position(categories, null) is null
    and octet_length(categories::text) <= 8192
  ),
  cover text not null default '' check (
    char_length(cover) <= 500 and (
      cover = '' or cover ~ '^https://(images\.igdb\.com|shared\.fastly\.steamstatic\.com)/'
    )
  ),
  steam_id bigint check (steam_id > 0 and steam_id <= 9007199254740991),
  igdb_id bigint check (igdb_id > 0 and igdb_id <= 9007199254740991),
  -- Client timestamp preserves the existing backup format; never used as an edit lock.
  updated_at bigint not null check (updated_at >= 0 and updated_at <= 9007199254740991),
  -- A server-owned edit counter lets the client detect stale changes from another device.
  revision bigint not null default 1 check (revision > 0),
  primary key (user_id, id),
  unique (user_id, steam_id),
  unique (user_id, igdb_id)
);

create table public.user_preferences (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  devices text[] not null default array['PC', 'Steam Deck', 'PS5', 'Switch 2']::text[] check (
    cardinality(devices) <= 4
    and devices <@ array['PC', 'Steam Deck', 'PS5', 'Switch 2']::text[]
    and array_position(devices, null) is null
  ),
  theme text not null default 'dark' check (theme in ('dark', 'light')),
  revision bigint not null default 1 check (revision > 0)
);

create function public.next_up_set_revision()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if TG_OP = 'INSERT' then
    NEW.revision := 1;
  else
    NEW.revision := OLD.revision + 1;
  end if;
  return NEW;
end;
$$;
-- Trigger functions are not callable by browser clients through the Data API.
revoke all on function public.next_up_set_revision() from public, anon, authenticated;

create trigger library_games_revision before insert or update on public.library_games
for each row execute function public.next_up_set_revision();
create trigger user_preferences_revision before insert or update on public.user_preferences
for each row execute function public.next_up_set_revision();

alter table public.library_games enable row level security;
alter table public.user_preferences enable row level security;

-- Explicit grants: no anonymous access and no TRUNCATE privilege for app users.
revoke all on public.library_games, public.user_preferences from public, anon, authenticated;
grant select, insert, update, delete on public.library_games, public.user_preferences to authenticated;

create policy games_select_own on public.library_games for select to authenticated
using ((select auth.uid()) = user_id);
create policy games_insert_own on public.library_games for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy games_update_own on public.library_games for update to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy games_delete_own on public.library_games for delete to authenticated
using ((select auth.uid()) = user_id);

create policy preferences_select_own on public.user_preferences for select to authenticated
using ((select auth.uid()) = user_id);
create policy preferences_insert_own on public.user_preferences for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy preferences_update_own on public.user_preferences for update to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy preferences_delete_own on public.user_preferences for delete to authenticated
using ((select auth.uid()) = user_id);

commit;
