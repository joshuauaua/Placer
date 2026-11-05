-- Lets Pin to Image host a room.
insert into public.toolkit_room_tools (id, name) values ('pin-to-image', 'Pin to Image')
on conflict (id) do update set name = excluded.name;
