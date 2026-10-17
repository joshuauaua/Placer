-- Lets the Idea Visualizer host a room.
insert into public.toolkit_room_tools (id, name) values ('reimagine-a-space', 'Idea Visualizer')
on conflict (id) do update set name = excluded.name;
