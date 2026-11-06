-- Generated from supabase/room-tools/people-moving-count.sql -- keep the two in step.
-- That file remains the documented Dashboard -> SQL Editor path
-- (see supabase/README.md); this is the same SQL under CLI control.

-- Lets People Moving Count host a room.
insert into public.toolkit_room_tools (id, name) values ('people-moving-count', 'People Moving Count')
on conflict (id) do update set name = excluded.name;
