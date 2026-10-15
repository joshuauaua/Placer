-- Lets Desire Lines host a room.
insert into public.toolkit_room_tools (id, name) values ('desire-lines', 'Desire Lines')
on conflict (id) do update set name = excluded.name;
