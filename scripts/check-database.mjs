import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

// Local PostgreSQL test harness; no credentials, network calls or hosted writes.
const db = new PGlite();
const alice = "11111111-1111-4111-8111-111111111111";
const bob = "22222222-2222-4222-8222-222222222222";
const game = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const secondGame = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
let checks = 0;
function check(actual, expected, description) {
  assert.deepEqual(actual, expected, description);
  checks++;
}
async function query(sql, params = []) {
  return db.query(sql, params);
}
async function scalar(sql, params = []) {
  return (await query(sql, params)).rows[0].value;
}
async function denied(sql, params = [], code = "42501") {
  await assert.rejects(
    () => query(sql, params),
    (error) => error.code === code,
  );
  checks++;
}
async function asUser(id) {
  await db.exec("reset role; set role authenticated;");
  await query("select set_config('request.jwt.claims', $1, false)", [
    JSON.stringify({ sub: id }),
  ]);
}
const insertGame = `insert into public.library_games
  (id, title, ownership, status, session, steam_id, updated_at)
  values ($1, 'Papers, Please', 'owned', 'Backlog', 'short', 239030, 1)`;
try {
  await db.exec(`
    create role supabase_auth_admin;
    create role anon;
    create role authenticated;
    create schema auth;
    create table auth.users (id uuid primary key);
    insert into auth.users values ('${alice}'), ('${bob}');
    create function auth.uid() returns uuid language sql stable as $$
      select coalesce(current_setting('request.jwt.claim.sub', true),
        (current_setting('request.jwt.claims', true)::jsonb ->> 'sub'))::uuid
    $$;
    create function auth.jwt() returns jsonb language sql stable as $$
      select current_setting('request.jwt.claims', true)::jsonb
    $$;
    grant usage on schema public, auth to anon, authenticated;
    alter default privileges in schema public grant all on tables to anon, authenticated;
  `);
  const migration = await readFile(
    new URL("../supabase/migrations/202609110001_library.sql", import.meta.url),
    "utf8",
  );
  await db.exec(migration);
  check(
    await scalar(
      "select count(*)::int as value from pg_policies where schemaname = 'public'",
    ),
    8,
    "Eight explicit owner policies",
  );
  check(
    await scalar(
      "select count(*)::int as value from pg_class where relname in ('library_games', 'user_preferences') and relrowsecurity",
    ),
    2,
    "RLS enabled on both tables",
  );

  await asUser(alice);
  await query(insertGame, [game]);
  await query("insert into public.user_preferences (theme) values ('dark')");
  check(
    await scalar("select user_id as value from public.library_games"),
    alice,
    "Ownership defaults to JWT subject",
  );
  check(
    await scalar("select revision::int as value from public.library_games"),
    1,
    "Initial revision",
  );
  await query(
    "update public.library_games set notes = 'Come back later', revision = 500 where id = $1",
    [game],
  );
  check(
    await scalar("select revision::int as value from public.library_games"),
    2,
    "Client cannot choose revision",
  );
  check(
    (
      await query(
        "update public.library_games set notes = 'Stale edit' where id = $1 and revision = 1 returning id",
        [game],
      )
    ).rows.length,
    0,
    "Stale conditional write changes nothing",
  );
  check(
    await scalar("select notes as value from public.library_games"),
    "Come back later",
    "Stale write preserved data",
  );
  await query(
    "update public.user_preferences set theme = 'light', revision = 400",
  );
  check(
    await scalar("select revision::int as value from public.user_preferences"),
    2,
    "Preferences counter is server-owned",
  );
  await denied(insertGame, [secondGame], "23505");
  await denied("update public.library_games set user_id = $1", [bob]);
  await denied("update public.user_preferences set user_id = $1", [bob]);
  await denied("insert into public.user_preferences (user_id) values ($1)", [
    bob,
  ]);
  await denied(
    "insert into public.library_games (user_id, id, title, ownership, status, session, updated_at) values ($1,$2,'Other','owned','Backlog','unknown',1)",
    [bob, secondGame],
  );
  await denied(
    "update public.library_games set status = 'Invalid'",
    [],
    "23514",
  );
  await denied(
    "update public.library_games set cover = 'https://evil.example/image.jpg'",
    [],
    "23514",
  );
  await denied(
    "update public.library_games set devices = array['Unknown']",
    [],
    "23514",
  );
  await denied(
    "update public.library_games set notes = repeat('a', 4001)",
    [],
    "23514",
  );
  await denied(
    "update public.user_preferences set theme = 'Invalid'",
    [],
    "23514",
  );
  for (const table of ["library_games", "user_preferences"]) {
    await denied(`truncate public.${table}`);
  }

  await asUser(bob);
  for (const table of ["library_games", "user_preferences"]) {
    check(
      await scalar(`select count(*)::int as value from public.${table}`),
      0,
      `${table}: another user's rows are hidden`,
    );
    check(
      (
        await query(
          `update public.${table} set revision = 10 where user_id = $1 returning user_id`,
          [alice],
        )
      ).rows.length,
      0,
      `${table}: cross-user update denied`,
    );
    check(
      (
        await query(
          `delete from public.${table} where user_id = $1 returning user_id`,
          [alice],
        )
      ).rows.length,
      0,
      `${table}: cross-user delete denied`,
    );
  }
  // Same game and provider ID are legitimate for two different users.
  await query(insertGame, [game]);
  await query(
    "insert into public.user_preferences (theme, revision) values ('dark', 900)",
  );
  check(
    await scalar("select revision::int as value from public.user_preferences"),
    1,
    "Insert also normalizes revision",
  );
  check(
    await scalar("select count(*)::int as value from public.library_games"),
    1,
    "Shared game ID remains scoped per user",
  );
  await query("delete from public.library_games where id = $1", [game]);
  check(
    await scalar("select count(*)::int as value from public.library_games"),
    0,
    "Owner can delete game",
  );
  await query(insertGame, [game]);
  await query("delete from public.user_preferences");
  check(
    await scalar("select count(*)::int as value from public.user_preferences"),
    0,
    "Owner can delete preferences",
  );
  await query("insert into public.user_preferences default values");

  await db.exec("reset role; set role anon;");
  for (const table of ["library_games", "user_preferences"]) {
    await denied(`select * from public.${table}`);
    await denied(`insert into public.${table} default values`);
    await denied(`update public.${table} set revision = 2`);
    await denied(`delete from public.${table}`);
    await denied(`truncate public.${table}`);
  }
  await db.exec("reset role; set role authenticated;");
  await query("select set_config('request.jwt.claims', '{}', false)");
  check(
    await scalar("select count(*)::int as value from public.library_games"),
    0,
    "No JWT subject means no readable games",
  );
  check(
    await scalar("select count(*)::int as value from public.user_preferences"),
    0,
    "No JWT subject means no readable preferences",
  );

  await db.exec("reset role;");
  await query("delete from auth.users where id = $1", [alice]);
  check(
    await scalar(
      "select count(*)::int as value from public.library_games where user_id = $1",
      [alice],
    ),
    0,
    "Account deletion cascades games",
  );
  check(
    await scalar(
      "select count(*)::int as value from public.user_preferences where user_id = $1",
      [alice],
    ),
    0,
    "Account deletion cascades preferences",
  );
  check(
    await scalar(
      "select count(*)::int as value from public.library_games where user_id = $1",
      [bob],
    ),
    1,
    "Other account preserved",
  );
  await assert.rejects(
    () => db.exec(migration),
    (error) => error.code === "42P07",
  );
  await db.exec("rollback");
  check(
    await scalar("select count(*)::int as value from public.library_games"),
    1,
    "Accidental rerun does not delete data",
  );
  await db.exec(
    await readFile(
      new URL(
        "../supabase/migrations/202609110002_library_operations.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await asUser(bob);
  const snapshot = async () =>
    JSON.parse(
      JSON.stringify(
        await scalar("select public.next_up_read_library() as value"),
      ),
    );
  let state = await snapshot();
  check(state.games.length, 1, "RPC reads only current user's games");
  const changedGame = { ...state.games[0], notes: "Saved remotely" };
  const mutate =
    "select public.next_up_change_library($1,$2::jsonb,$3::jsonb,$4::uuid[],$5) as value";
  const before = state.revision;
  state = await scalar(mutate, [
    before,
    JSON.stringify([changedGame]),
    null,
    [],
    false,
  ]);
  check(
    state.revision,
    before + 1,
    "Game mutation advances whole-library counter",
  );
  check(
    state.games[0].notes,
    "Saved remotely",
    "Atomic mutation returns updated snapshot",
  );
  await denied(
    mutate,
    [
      before,
      JSON.stringify([{ ...changedGame, notes: "stale" }]),
      null,
      [],
      false,
    ],
    "PT409",
  );
  check(
    (await snapshot()).games[0].notes,
    "Saved remotely",
    "Retry/stale device cannot overwrite data",
  );
  await denied(
    mutate,
    [
      state.revision,
      JSON.stringify([{ ...changedGame, status: "bad" }]),
      null,
      [],
      true,
    ],
    "23514",
  );
  check(
    (await snapshot()).games.length,
    1,
    "Failed replace rolls back deletion",
  );
  check(
    (await snapshot()).revision,
    state.revision,
    "Failed mutation does not advance counter",
  );
  await denied(
    mutate,
    [
      state.revision,
      "[]",
      JSON.stringify({ id: "preferences", devices: [], theme: "bad" }),
      [],
      true,
    ],
    "23514",
  );
  check(
    (await snapshot()).games.length,
    1,
    "Bad settings also roll back replacement",
  );
  for (const table of ["library_games", "user_preferences"]) {
    await denied(`update public.${table} set revision=4`);
    await denied(`delete from public.${table}`);
  }
  const newUser = "33333333-3333-4333-8333-333333333333";
  await db.exec("reset role");
  await query("insert into auth.users values ($1)", [newUser]);
  await asUser(newUser);
  check((await snapshot()).revision, 0, "New account starts empty");
  await scalar(mutate, [0, JSON.stringify([changedGame]), null, [], false]);
  check(
    (await snapshot()).games.length,
    1,
    "New account can import the same game independently",
  );
  await asUser(bob);
  check(
    (await snapshot()).games.length,
    1,
    "Other account mutations preserve Bob",
  );
  await scalar(mutate, [
    state.revision,
    "[]",
    JSON.stringify({ id: "preferences", devices: [], theme: "dark" }),
    [],
    true,
  ]);
  check((await snapshot()).games.length, 0, "Atomic erase clears own games");
  await db.exec("reset role;set role anon");
  await denied("select public.next_up_read_library()");
  await denied("select public.next_up_change_library(0)");
  await db.exec("reset role");
  await db.exec(
    await readFile("supabase/migrations/202609140001_mcp_access.sql", "utf8"),
  );
  const clientId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  const resource = "https://next-up.deivbid.workers.dev/api/mcp";
  const grant = `select public.next_up_set_mcp_connection($1,'My AI',$2,$3)`;
  const claims = async (value) =>
    query("select set_config('request.jwt.claims',$1,false)", [
      JSON.stringify(value),
    ]);
  const hook = async (id, client) => {
    await db.exec("reset role; set role supabase_auth_admin");
    const result = await scalar(
      "select public.next_up_mcp_token_hook($1::jsonb) as value",
      [
        JSON.stringify({
          user_id: id,
          claims: {
            sub: id,
            role: "authenticated",
            aud: "authenticated",
            ...(client ? { client_id: client } : {}),
          },
        }),
      ],
    );
    await db.exec("reset role; set role authenticated");
    return result.claims;
  };
  await asUser(newUser);
  const beforeMcp = await snapshot();
  check(beforeMcp.games.length, 1, "MCP migration preserves web library");
  await query(grant, [clientId, "read", resource]);
  check(
    await scalar("select count(*)::int as value from public.mcp_connections"),
    1,
    "Web can see its connection",
  );
  const readClaims = await hook(newUser, clientId);
  check(
    readClaims.aud,
    ["authenticated", resource],
    "Hook issues explicit Supabase and MCP audiences",
  );
  await claims(readClaims);
  check((await snapshot()).games.length, 1, "Read-only MCP sees own games");
  check(
    await scalar("select count(*)::int as value from public.mcp_connections"),
    0,
    "MCP cannot read connection administration table",
  );
  await denied(grant, [clientId, "write", resource]);
  await denied("select next_up_private.next_up_read_library()");
  await denied(mutate, [
    beforeMcp.revision,
    JSON.stringify([changedGame]),
    null,
    [],
    false,
  ]);
  check(
    await scalar("select public.next_up_mcp_access() as value"),
    { permission: "read" },
    "MCP permission is verified in DB",
  );
  await claims({ ...readClaims, sub: bob });
  await denied("select public.next_up_read_library()");
  check(
    await scalar("select count(*)::int as value from public.library_games"),
    0,
    "Another owner cannot use the grant via REST",
  );
  await asUser(newUser);
  await query(grant, [clientId, "write", resource]);
  const writeClaims = await hook(newUser, clientId);
  await claims(readClaims);
  await denied("select public.next_up_read_library()");
  await claims(writeClaims);
  const current = await snapshot();
  const gameUpdate = {
    ...current.games[0],
    devices: ["PC", "PS5"],
    notes: "MCP edit",
  };
  const after = await scalar(mutate, [
    current.revision,
    JSON.stringify([gameUpdate]),
    null,
    [],
    false,
  ]);
  check(
    after.games[0].devices,
    ["PC", "PS5"],
    "MCP update preserves multiple devices",
  );
  await denied(
    mutate,
    [current.revision, JSON.stringify([gameUpdate]), null, [], false],
    "PT409",
  );
  await denied(mutate, [after.revision, "[]", null, [], true]);
  await denied(mutate, [
    after.revision,
    "[]",
    JSON.stringify({ id: "preferences", devices: [], theme: "light" }),
    [],
    false,
  ]);
  await denied(mutate, [
    after.revision,
    JSON.stringify([gameUpdate]),
    null,
    [gameUpdate.id],
    false,
  ]);
  await asUser(newUser);
  await query(grant, [clientId, null, resource]);
  await claims(writeClaims);
  await denied("select public.next_up_read_library()");
  await denied(mutate, [
    after.revision,
    JSON.stringify([gameUpdate]),
    null,
    [],
    false,
  ]);
  check(
    await scalar("select count(*)::int as value from public.library_games"),
    0,
    "Revoked JWT cannot bypass MCP through direct REST reads",
  );
  await denied("select public.next_up_mcp_token_hook('{}')");
  const noGrant = await hook(newUser, clientId);
  check(noGrant.aud, "authenticated", "No grant means no MCP audience");
  check(
    noGrant.next_up_grant,
    undefined,
    "No grant generation after revocation",
  );
  await asUser(newUser);
  await query(grant, [clientId, "write", resource]);
  await claims(writeClaims);
  await denied("select public.next_up_read_library()");
  const webClaims = await hook(newUser);
  check(
    webClaims,
    { sub: newUser, role: "authenticated", aud: "authenticated" },
    "Hook leaves Google/web sessions unchanged",
  );
  await claims(webClaims);
  check((await snapshot()).games[0].notes, "MCP edit", "Web sees MCP changes");
  await db.exec("reset role; set role anon");
  await denied("select public.next_up_mcp_access()");
  await denied(grant, [clientId, "write", resource]);
  console.log(
    `PASS: ${checks} database checks (local PostgreSQL/PGlite; hosted auth not exercised).`,
  );
} finally {
  await db.close();
}
