-- Lets the Site-Specific Spatial Mapping Tool host a room.
insert into public.toolkit_room_tools (id, name) values ('site-spatial-mapping', 'Site-Specific Spatial Mapping Tool')
on conflict (id) do update set name = excluded.name;
