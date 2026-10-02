<!--
Contributions are limited to the Toolkit. See CONTRIBUTING.md — and if this change
needs to reach outside it, open an issue instead of a pull request.
-->

## What this changes

<!-- One or two sentences. For a new tool, say what argument it makes. -->

## Why

<!-- What is better afterwards. For a tool: what is hard to see without it. -->

## Checks

- [ ] `npm run test:run` passes, and there are tests for what I changed
- [ ] `npm run lint` passes
- [ ] `git diff --name-only Development...HEAD | npm run toolkit:scope` passes
- [ ] Everything reachable by mouse is reachable by keyboard
- [ ] No new dependencies

## Anything needing the owner

<!--
Delete if none. The usual two:
  - a new icon, since src/components/Icon.jsx is shared and closed
  - a room-capable tool, which also needs the allowlist in supabase/rooms.sql
-->

## Where the numbers came from

<!--
Only for a tool with figures in it. They are meant to be rough but not
arbitrary — say what you calibrated against.
-->
