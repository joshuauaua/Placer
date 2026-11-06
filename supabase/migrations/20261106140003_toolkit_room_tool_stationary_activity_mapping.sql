-- Generated from supabase/room-tools/stationary-activity-mapping.sql -- keep the two in step.
-- That file remains the documented Dashboard -> SQL Editor path
-- (see supabase/README.md); this is the same SQL under CLI control.

-- Lets Stationary Activity Mapping host a room.
insert into public.toolkit_room_tools (id, name) values ('stationary-activity-mapping', 'Stationary Activity Mapping')
on conflict (id) do update set name = excluded.name;
