-- PLACER — deleting a Toolkit room.
--
-- Closing a room (toolkit_room_close, rooms.sql) stops it taking contributions but
-- keeps the row until the sweep in rooms-cleanup.sql lets it go a day after it ends.
-- Deleting removes it now: the room and every contribution in it, which cascade from
-- toolkit_rooms (rooms.sql, section 2). There is no undo.
--
-- The same shape as closing. toolkit_rooms has no grants to anon or authenticated,
-- so this is a security definer function, and the facilitator token is checked in
-- here — a client that knows a room's id, which every participant does, still
-- cannot delete it. The token is held by the browser that opened the room and, for a
-- room made for a project, handed to its owner and collaborators by project_rooms
-- (rooms-lifetime.sql), which is how the project dashboard can delete one too.
--
-- Unlike closing, an ended room can be deleted: getting rid of what a finished
-- workshop held, without waiting a day for the sweep, is the point.
--
-- Run this once in the Supabase SQL editor, after rooms.sql. It is safe to re-run.


create or replace function public.toolkit_room_delete(p_room_id uuid, p_token uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted int;
begin
  delete from public.toolkit_rooms
   where id = p_room_id
     and facilitator_token = p_token;

  get diagnostics v_deleted = row_count;
  return v_deleted > 0;
end;
$$;

revoke all on function public.toolkit_room_delete(uuid, uuid) from public;
grant execute on function public.toolkit_room_delete(uuid, uuid) to anon, authenticated;


-- Verify, after running the above:
--
--   select proname from pg_proc where proname = 'toolkit_room_delete';
