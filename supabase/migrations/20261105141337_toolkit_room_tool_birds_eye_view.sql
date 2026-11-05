-- Generated from supabase/room-tools/birds-eye-view.sql -- keep the two in step.
-- That file remains the documented Dashboard -> SQL Editor path
-- (see supabase/README.md); this is the same SQL under CLI control.

-- Lets Birds Eye View host a room.
insert into public.toolkit_room_tools (id, name) values ('birds-eye-view', 'Birds Eye View')
on conflict (id) do update set name = excluded.name;
