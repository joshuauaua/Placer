-- Lets People Moving Count host a room.
insert into public.toolkit_room_tools (id, name) values ('people-moving-count', 'People Moving Count')
on conflict (id) do update set name = excluded.name;
