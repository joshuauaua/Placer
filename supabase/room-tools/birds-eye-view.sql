-- Lets Birds Eye View host a room.
insert into public.toolkit_room_tools (id, name) values ('birds-eye-view', 'Birds Eye View')
on conflict (id) do update set name = excluded.name;
