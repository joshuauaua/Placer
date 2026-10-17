-- Generated from supabase/room-tools/reimagine-a-space.sql -- keep the two in step.
-- That file remains the documented Dashboard -> SQL Editor path
-- (see supabase/README.md); this is the same SQL under CLI control.

-- Lets the Idea Visualizer host a room.
insert into public.toolkit_room_tools (id, name) values ('reimagine-a-space', 'Idea Visualizer')
on conflict (id) do update set name = excluded.name;
