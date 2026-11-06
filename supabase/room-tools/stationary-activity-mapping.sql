-- Lets Stationary Activity Mapping host a room.
insert into public.toolkit_room_tools (id, name) values ('stationary-activity-mapping', 'Stationary Activity Mapping')
on conflict (id) do update set name = excluded.name;
