/* PLACER — the Workshop Room's schedule, beside the tool being run.
 *
 * What ran earlier today, what is on now and what comes next, from the project's
 * rooms (readProjectRoomSchedule, supabase/project-room-schedule.sql). Only what is on
 * now can be picked: picking it makes it the current workshop, the one tool the room
 * shows. A tool that does not run in a room is on whenever the Workshop Room is, so it
 * is listed as on now, with no times.
 *
 * Below it, the Archived list: the workshops that finished on an earlier day, newest
 * first (workshopArchive). Only the latest few are shown until asked for the rest.
 */

import { useState } from 'react';
import { findTool } from '../toolkit/tools';

const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()
  && a.getDate() === b.getDate();

/** '14:30' today; '24 Oct, 10:00' on another day. */
export function scheduleTime(value, now = new Date()) {
  const date = new Date(value ?? NaN);
  if (!Number.isFinite(date.getTime())) return null;
  const time = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  if (sameDay(date, now)) return time;
  return `${date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}, ${time}`;
}

/**
 * The schedule's items, in order: what finished earlier today, what is on now, then
 * what comes next. `sections` are the Workshop Room's live sections, whose keys are
 * what picking an item selects; `tools` the ids of the tools in the Workshop Room;
 * `schedule` the project's rooms, or null when they could not be read — then only what
 * is on now is listed, from the sections. Each item is
 * { key, tool, state: 'done' | 'now' | 'next', opensAt, closesAt, sectionKey }, `sectionKey`
 * null for one that cannot be picked.
 */
export function workshopSchedule({ sections, tools, schedule, now = new Date() }) {
  const bySection = new Map(sections.map((section) => [section.key, section]));
  const untimed = sections.filter((section) => !section.room).map((section) => ({
    key: section.key, tool: section.tool, state: 'now', opensAt: null, closesAt: null,
    sectionKey: section.key,
  }));

  if (!schedule) {
    const open = sections.filter((section) => section.room).map((section) => ({
      key: section.key, tool: section.tool, state: 'now', opensAt: null,
      closesAt: section.room.expiresAt ?? null, sectionKey: section.key,
    }));
    return [...untimed, ...open];
  }

  const timed = schedule
    .filter((room) => tools.has(room.tool))
    .map((room) => {
      const sectionKey = `room:${room.id}`;
      const section = bySection.get(sectionKey);
      const state = room.status === 'scheduled' ? 'next' : room.status === 'open' ? 'now' : 'done';
      return { key: sectionKey, tool: section?.tool ?? findTool(room.tool), state,
        opensAt: room.opensAt, closesAt: room.closesAt, sectionKey: section ? sectionKey : null };
    })
    // Earlier days are history, not the day's schedule. An open room the page has no
    // section for (its tool is not live) cannot be shown, so is not listed as on.
    .filter((item) => (item.state === 'done' ? sameDay(new Date(item.closesAt ?? NaN), now) : true))
    .filter((item) => item.state !== 'now' || item.sectionKey);

  return [
    ...timed.filter((item) => item.state === 'done'),
    ...untimed,
    ...timed.filter((item) => item.state === 'now'),
    ...timed.filter((item) => item.state === 'next'),
  ];
}

/**
 * The workshops that finished on an earlier day than `now`, newest first, as
 * { key, tool, opensAt, closesAt }: the rooms of the Workshop Room's `tools` in
 * `schedule` (readProjectRoomSchedule), or none when it could not be read.
 */
export function workshopArchive({ tools, schedule, now = new Date() }) {
  return (schedule ?? [])
    .filter((room) => tools.has(room.tool) && (room.status === 'closed' || room.status === 'expired'))
    .filter((room) => {
      const closed = new Date(room.closesAt ?? NaN);
      return Number.isFinite(closed.getTime()) && !sameDay(closed, now) && closed < now;
    })
    .map((room) => ({ key: `room:${room.id}`, tool: findTool(room.tool), opensAt: room.opensAt, closesAt: room.closesAt }))
    .sort((a, b) => new Date(b.closesAt) - new Date(a.closesAt));
}

/** '14 Oct, 10:00 – 12:00', or both days in full when it ran past midnight. */
function archiveTime({ opensAt, closesAt }) {
  const opened = scheduleTime(opensAt);
  const closed = scheduleTime(closesAt, new Date(opensAt ?? NaN));
  return [opened, closed].filter(Boolean).join(' – ');
}

// How many of the archive are shown before "Show all".
const ARCHIVE_SHOWN = 5;

const STATE_LABEL = { done: 'Finished', now: 'Now', next: 'Up next' };

function Archive({ t, items }) {
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, ARCHIVE_SHOWN);
  return (
    <section aria-labelledby="workshop-archive-heading" style={{ marginTop: 20, paddingTop: 16,
      borderTop: `1px solid ${t.line}` }}>
      <h3 id="workshop-archive-heading" style={{ fontSize: 15, fontWeight: 700, color: t.ink, marginBottom: 8 }}>
        Archived
      </h3>
      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {shown.map((item) => (
          <li key={item.key} style={{ padding: '6px 12px' }}>
            <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: t.inkDim }}>
              {item.tool?.name ?? 'Workshop'}
            </span>
            <span style={{ display: 'block', fontSize: 13, color: t.inkDim }}>{archiveTime(item)}</span>
          </li>
        ))}
      </ol>
      {items.length > ARCHIVE_SHOWN && (
        <button type="button" aria-expanded={all} onClick={() => setAll((was) => !was)}
          style={{ marginTop: 8, padding: '6px 12px', border: 'none', background: 'none', cursor: 'pointer',
            fontFamily: 'var(--placer-font)', fontSize: 13, fontWeight: 700, color: t.ink, textDecoration: 'underline' }}>
          {all ? 'Show fewer' : `Show all ${items.length}`}
        </button>
      )}
    </section>
  );
}

export function WorkshopSchedule({ t, items, archive = [], currentKey, onPick }) {
  return (
    <aside aria-labelledby="workshop-schedule-heading" className="placer-workshop-schedule"
      style={{ background: t.surface, border: `1px solid ${t.line}`, borderRadius: 16, padding: 20 }}>
      <h2 id="workshop-schedule-heading" style={{ fontSize: 17, fontWeight: 700, color: t.ink, marginBottom: 12 }}>
        Schedule
      </h2>
      {items.length === 0 ? (
        <p style={{ fontSize: 14, color: t.inkDim }}>Nothing else is scheduled.</p>
      ) : (
        <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {items.map((item) => {
            const current = item.sectionKey !== null && item.sectionKey === currentKey;
            const name = item.tool?.name ?? 'Workshop';
            const when = item.state === 'next'
              ? scheduleTime(item.opensAt)
              : item.state === 'now'
                ? (item.closesAt ? `Until ${scheduleTime(item.closesAt)}` : 'Open now')
                : [scheduleTime(item.opensAt), scheduleTime(item.closesAt)].filter(Boolean).join(' – ');
            const body = (
              <>
                <span style={{ width: 10, height: 10, marginTop: 5, borderRadius: 999, flex: '0 0 auto',
                  background: item.state === 'now' ? t.ink : 'transparent',
                  border: `2px solid ${item.state === 'done' ? t.inkFaint : t.ink}` }} />
                <span style={{ minWidth: 0 }}>
                  <span className="placer-caption" style={{ display: 'block', textTransform: 'uppercase',
                    letterSpacing: '0.08em', fontWeight: 700, color: t.inkDim }}>
                    {STATE_LABEL[item.state]}
                  </span>
                  <span style={{ display: 'block', fontSize: 15, fontWeight: 700,
                    color: item.state === 'done' ? t.inkDim : t.ink }}>
                    {name}
                  </span>
                  {when && <span style={{ display: 'block', fontSize: 13, color: t.inkDim }}>{when}</span>}
                </span>
              </>
            );
            const rowStyle = { display: 'flex', gap: 12, alignItems: 'flex-start', width: '100%', padding: '10px 12px',
              borderRadius: 12, textAlign: 'left', fontFamily: 'var(--placer-font)',
              background: current ? t.surfaceAlt : 'transparent', border: 'none' };
            return (
              <li key={item.key}>
                {item.sectionKey ? (
                  <button type="button" aria-current={current ? 'true' : undefined} onClick={() => onPick(item.sectionKey)}
                    style={{ ...rowStyle, cursor: 'pointer' }}>
                    {body}
                  </button>
                ) : (
                  <div style={rowStyle}>{body}</div>
                )}
              </li>
            );
          })}
        </ol>
      )}
      {archive.length > 0 && <Archive t={t} items={archive} />}
    </aside>
  );
}
