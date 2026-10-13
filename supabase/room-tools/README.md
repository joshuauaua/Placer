# Room tools

One file per Toolkit tool that can run in a room, named for its id, e.g.
`dream-it.sql` for `src/toolkit/tools/dream-it.js`. Each inserts the tool's row into
`toolkit_room_tools` (see `../room-tools.sql`), which is what lets the database host a
room for it:

```sql
-- Lets the Dream It host a room.
insert into public.toolkit_room_tools (id, name) values ('dream-it', 'Dream It')
on conflict (id) do update set name = excluded.name;
```

Then run `node scripts/check-migrations.mjs --write`. It generates the file's migration,
`supabase/migrations/<now>_toolkit_room_tool_dream_it.sql`, and from then on checks that
the two stay in step. Nothing else needs editing, so two branches each adding a tool
don't touch the same lines.

The tools that could host a room before `toolkit_room_tools` existed (Co-Budget, Poll,
Pop Quiz and Word Cloud) are seeded by `../room-tools.sql` itself.
