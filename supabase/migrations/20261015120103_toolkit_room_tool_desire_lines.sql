-- Generated from supabase/room-tools/desire-lines.sql -- keep the two in step.
-- That file remains the documented Dashboard -> SQL Editor path
-- (see supabase/README.md); this is the same SQL under CLI control.

-- Lets Desire Lines host a room.
insert into public.toolkit_room_tools (id, name) values ('desire-lines', 'Desire Lines')
on conflict (id) do update set name = excluded.name;
