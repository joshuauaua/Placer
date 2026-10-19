-- Generated from supabase/room-tools/site-spatial-mapping.sql -- keep the two in step.
-- That file remains the documented Dashboard -> SQL Editor path
-- (see supabase/README.md); this is the same SQL under CLI control.

-- Lets the Site-Specific Spatial Mapping Tool host a room.
insert into public.toolkit_room_tools (id, name) values ('site-spatial-mapping', 'Site-Specific Spatial Mapping Tool')
on conflict (id) do update set name = excluded.name;
