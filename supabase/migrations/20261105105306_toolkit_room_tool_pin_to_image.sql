-- Generated from supabase/room-tools/pin-to-image.sql -- keep the two in step.
-- That file remains the documented Dashboard -> SQL Editor path
-- (see supabase/README.md); this is the same SQL under CLI control.

-- Lets Pin to Image host a room.
insert into public.toolkit_room_tools (id, name) values ('pin-to-image', 'Pin to Image')
on conflict (id) do update set name = excluded.name;
