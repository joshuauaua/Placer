/* PLACER — Toolkit: the participatory methods PLACER hosts, as tools to use.
 *
 * Each tool is a method made by an organisation, in one of three categories —
 * Understand, Imagine or Plan — and the gallery lists them under those headings.
 * Each is self-contained: no sign-in, nothing saved, and something moving within a
 * second of arriving. The register of tools is src/toolkit/tools.js.
 *
 * The exception to "nothing saved" is a room: a tool whose register entry has
 * a `room` can be opened up to a roomful of people, who join it with a PIN or a QR
 * code and whose answers are held in Supabase until the facilitator closes it. This
 * page owns the room the way it owns the tool — off the URL, in ?room= — and
 * hands it to the tool as a prop.
 *
 * The page owns the /toolkit part of the URL itself rather than taking the selected
 * tool as a prop, so every tool has a link that can be shared.
 */

import { useEffect, useState } from 'react';
import { useLocation, useSearch } from 'wouter';
import posthog from 'posthog-js';
import { Icon } from './Icon';
import { PageHeader } from './PageHeader';
import { Btn, Chip } from './UI';
import { ToolLayout } from './ToolLayout';
import { RoomBar } from './toolkit/RoomBar';
import { ToolCover } from './toolkit/ToolCover';
import { ContributeToolDialog } from './ContributeToolDialog';
import { useRoom } from './toolkit/useRoom';
import { CATEGORIES, ORGANISATIONS, TOOLS, filterTools, findCategory, findTool } from '../toolkit/tools';
import { DEFAULT_LIFETIME, ROOM_LIFETIMES, projectIdFrom, roomIdFrom, roomPath } from '../toolkit/rooms';
import { isSupabaseConfigured } from '../services/rooms';

/** The tool id in a path like /toolkit/street-mixer, if there is one. */
export function toolIdFrom(path) {
  const match = /^\/toolkit\/([^/?#]+)/.exec(path);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function Tile({ t, tool, onOpen }) {
  return (
    <button
      onClick={onOpen}
      style={{ position: 'relative', overflow: 'hidden', textAlign: 'left', cursor: 'pointer',
        border: `1px solid ${tool.color}`, borderRadius: 16, padding: 24, minHeight: 220,
        background: tool.tint,
        color: t.ink, display: 'flex', flexDirection: 'column', gap: 8,
        fontFamily: 'var(--placer-font)', boxShadow: 'none',
        transition: 'box-shadow 0.2s' }}
      onMouseEnter={(event) => { event.currentTarget.style.boxShadow = t.shadow; }}
      onMouseLeave={(event) => { event.currentTarget.style.boxShadow = 'none'; }}>
      {/* The tool's own mark, oversized and half out of frame. */}
      <span aria-hidden="true" style={{ position: 'absolute', right: -18, bottom: -22, opacity: 0.18 }}>
        <Icon name={tool.icon} size={150} stroke={1.4} />
      </span>

      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, position: 'relative' }}>
        <Icon name={tool.icon} size={30} stroke={2.1} />
        <CategoryLabel t={t} tool={tool} />
      </span>
      <span className="placer-h3" style={{ position: 'relative' }}>
        {tool.name}
      </span>
      <span style={{ fontSize: 16, lineHeight: '24px', position: 'relative', maxWidth: 320 }}>
        {tool.tagline}
      </span>
      {tool.createdBy && (
        <span className="placer-caption" style={{ color: t.inkDim, position: 'relative' }}>
          By {tool.createdBy}
        </span>
      )}
      <div style={{ flex: 1 }} />
      <span className="placer-label" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, position: 'relative' }}>
        Open <Icon name="arrowRight" size={14} stroke={2.4} />
      </span>
    </button>
  );
}

/** The tool's category, small and in capitals, so it reads without the grouping. */
function CategoryLabel({ t, tool }) {
  return (
    <span className="placer-caption" style={{ textTransform: 'uppercase', fontWeight: 700,
      letterSpacing: '0.06em', color: t.ink }}>
      {findCategory(tool.category)?.name}
    </span>
  );
}

/** One tool as a row, for the list view: the same facts as a tile, side by side. */
function Row({ t, tool, onOpen }) {
  return (
    <button
      onClick={onOpen}
      className="placer-toolkit-row"
      style={{ display: 'flex', alignItems: 'center', gap: 16, width: '100%', textAlign: 'left', cursor: 'pointer',
        padding: '16px 20px', border: 'none', borderBottom: `1px solid ${t.line}`, background: 'transparent',
        color: t.ink, fontFamily: 'var(--placer-font)' }}>
      <span style={{ width: 44, height: 44, borderRadius: 12, background: tool.tint, flex: '0 0 auto',
        boxShadow: `inset 0 0 0 1px ${tool.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={tool.icon} size={22} stroke={2.1} />
      </span>
      <span style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 17, fontWeight: 700 }}>{tool.name}</span>
        <span style={{ fontSize: 14, color: t.inkDim }}>{tool.tagline}</span>
      </span>
      <span className="placer-toolkit-row-meta" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
        gap: 2, flex: '0 0 auto' }}>
        <CategoryLabel t={t} tool={tool} />
        {tool.createdBy && (
          <span className="placer-caption" style={{ color: t.inkDim }}>By {tool.createdBy}</span>
        )}
      </span>
      <Icon name="arrowRight" size={18} stroke={2.2} style={{ color: t.inkDim }} />
    </button>
  );
}

/** Grid or list, as a pair of toggle buttons. */
function ViewToggle({ t, view, onChange }) {
  const option = (id, icon, label) => (
    <button
      type="button"
      onClick={() => onChange(id)}
      aria-pressed={view === id}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 12px',
        border: 'none', borderRadius: 10, cursor: 'pointer', fontFamily: 'var(--placer-font)',
        fontSize: 14, fontWeight: 500, color: t.ink,
        background: view === id ? t.surface : 'transparent',
        boxShadow: view === id ? `inset 0 0 0 1px ${t.lineStrong}` : 'none' }}>
      <Icon name={icon} size={15} stroke={2} />
      {label}
    </button>
  );

  return (
    <div role="group" aria-label="View" style={{ display: 'inline-flex', gap: 2, padding: 2, borderRadius: 12,
      background: t.surfaceAlt, border: `1px solid ${t.line}` }}>
      {option('grid', 'grid', 'Grid')}
      {option('list', 'menu', 'List')}
    </div>
  );
}

// The view a visitor last picked, remembered in this browser only. Storage can be
// missing or throw (a private window, blocked site data), and then it is just grid.
const VIEW_KEY = 'placer_toolkit_view';

function readView() {
  try {
    return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'grid';
  } catch {
    return 'grid';
  }
}

function saveView(view) {
  try {
    localStorage.setItem(VIEW_KEY, view);
  } catch {
    // Not remembered, which is fine.
  }
}

const NO_FILTERS = { query: '', category: null, organisation: null, groupOnly: false };

/**
 * The search box and filter chips above the gallery. `filters` is the shape
 * filterTools takes; every change hands back a whole new one.
 */
function ToolFilters({ t, filters, onChange }) {
  const set = (change) => onChange({ ...filters, ...change });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 40, paddingBottom: 32,
      borderBottom: `1px solid ${t.line}` }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, height: 52, width: '100%', padding: '0 16px',
        borderRadius: 12, border: `1px solid ${t.lineStrong}`, background: t.surface, color: t.ink }}>
        <Icon name="search" size={19} stroke={2} style={{ color: t.inkDim }} />
        <input
          type="search"
          value={filters.query}
          onChange={(event) => set({ query: event.target.value })}
          placeholder="Search tools, methods or organisations"
          aria-label="Search the Toolkit"
          style={{ flex: 1, minWidth: 0, height: '100%', border: 'none', outline: 'none', background: 'transparent',
            fontFamily: 'var(--placer-font)', fontSize: 15, color: t.ink }} />
      </label>

      <FilterRow t={t} label="Category">
        <Chip t={t} active={!filters.category} ariaPressed={!filters.category}
          onClick={() => set({ category: null })}>All</Chip>
        {CATEGORIES.map((category) => (
          <Chip key={category.id} t={t} active={filters.category === category.id}
            ariaPressed={filters.category === category.id}
            onClick={() => set({ category: filters.category === category.id ? null : category.id })}>
            {category.name}
          </Chip>
        ))}
      </FilterRow>

      <FilterRow t={t} label="Made by">
        <Chip t={t} active={!filters.organisation} ariaPressed={!filters.organisation}
          onClick={() => set({ organisation: null })}>Anyone</Chip>
        {ORGANISATIONS.map((organisation) => (
          <Chip key={organisation} t={t} active={filters.organisation === organisation}
            ariaPressed={filters.organisation === organisation}
            onClick={() => set({ organisation: filters.organisation === organisation ? null : organisation })}>
            {organisation}
          </Chip>
        ))}
      </FilterRow>

      <FilterRow t={t} label="Use">
        <Chip t={t} icon="user" active={filters.groupOnly} ariaPressed={filters.groupOnly}
          title="Tools that can be run in a room, with people joining by PIN or QR code"
          onClick={() => set({ groupOnly: !filters.groupOnly })}>
          Works with a group
        </Chip>
      </FilterRow>
    </div>
  );
}

function FilterRow({ t, label, children }) {
  return (
    <div role="group" aria-label={label} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <span className="placer-caption" style={{ width: 72, color: t.inkDim, fontWeight: 500 }}>{label}</span>
      {children}
    </div>
  );
}

/**
 * Offered on a tool that can host a room, when there is a database to host it in
 * and somebody with an account to open it.
 *
 * Opened from a project, the room can also be left running for weeks — a poll on a
 * poster rather than a workshop — so how long it stays open becomes a choice. Without a
 * project there is no choice to offer: a long room needs somebody who can find it again
 * and close it, and the database refuses one that has no project behind it
 * (supabase/rooms-lifetime.sql).
 */
function StartRoom({ t, tool, onStart, busy, canStayOpen }) {
  const [lifetime, setLifetime] = useState(DEFAULT_LIFETIME);

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      {canStayOpen && (
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13,
          fontWeight: 500, color: t.inkDim }}>
          Open for
          <select
            value={lifetime}
            onChange={(event) => setLifetime(event.target.value)}
            disabled={busy}
            style={{ height: 40, padding: '0 12px', borderRadius: 12, border: `1px solid ${t.lineStrong}`,
              background: t.surface, color: t.ink, fontFamily: 'var(--placer-font)', fontSize: 14,
              fontWeight: 500 }}>
            {ROOM_LIFETIMES.map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
        </label>
      )}
      <Btn
        t={t}
        size="sm"
        icon="user"
        variant="character"
        tone={tool}
        onClick={() => onStart(lifetime)}
        disabled={busy}>
        {busy ? 'Opening…' : 'Start a room'}
      </Btn>
    </div>
  );
}

/**
 * What stands in for the button when nobody is signed in.
 *
 * Shown rather than hiding the control, because a feature that silently is not there
 * reads as a feature that is broken. Opening a room is the one thing in the Toolkit that
 * takes an account — it creates something other people join, and it is enforced in
 * supabase/rooms.sql, where toolkit_room_create is the only function the anon role may
 * not call. Joining a room needs nothing, which is the point: a participant scans a code
 * and starts, and being asked to make an account at that moment would cost the room the
 * people it was opened for.
 */
function StartRoomSignedOut({ t, onSignIn }) {
  return (
    <Btn t={t} size="sm" variant="outline" icon="user" onClick={onSignIn}>
      Sign in to start a room
    </Btn>
  );
}

export function ToolkitPage({ t, displayName = null, needsAccount = false, onSignIn }) {
  const [location, navigate] = useLocation();
  const search = useSearch();
  const requestedId = toolIdFrom(location);
  const tool = requestedId ? findTool(requestedId) : null;
  const missing = requestedId && !tool ? requestedId : null;

  const projectId = projectIdFrom(search);

  const room = useRoom({
    tool,
    roomId: roomIdFrom(search),
    // Whatever the person calls themselves, so a facilitator can see who has answered.
    // Passed in from App rather than read here: with accounts the name comes from a
    // request, and this is a render body. It is still a label rather than proof of
    // identity — a room is joined with its PIN, not with an account.
    displayName,
    // Only meaningful for a room being opened, not one being joined — see
    // projectIdFrom's own comment. A ProjectDashboardPage link is what sets this.
    projectId,
    onOpened: (id) => {
      posthog.capture('sandbox_room_opened', { experiment: tool.id });
      navigate(roomPath(tool.id, id));
    },
  });

  useEffect(() => {
    if (!tool) return;
    posthog.capture('sandbox_experiment_opened', { experiment: tool.id });
  }, [tool]);

  // Which tool has been started past its cover. An id rather than a flag, so
  // opening a different tool lands on that one's cover rather than skipping it,
  // and opening a room (which only changes the query string) does not bring it back.
  const [startedId, setStartedId] = useState(null);

  // The Contribute button's pop-up form, for offering a tool to the PLACER Toolkit.
  const [contributing, setContributing] = useState(false);

  // The gallery's search and filters. Held here rather than in the URL: they are a
  // way of browsing, not something worth a link of its own.
  const [filters, setFilters] = useState(NO_FILTERS);
  const matching = filterTools(TOOLS, filters);
  const [view, setView] = useState(readView);
  const changeView = (next) => { setView(next); saveView(next); };
  const filtering = filters.query.trim() !== ''
    || Boolean(filters.category || filters.organisation) || filters.groupOnly;

  const Tool = tool?.component;
  // Offered only where a room would mean something, and only with a database behind it.
  const roomIsPossible =
    Boolean(tool?.room) && isSupabaseConfigured() && room.status === 'none';
  // Opening one also takes an account. Joining one does not — nothing on this page is
  // gated for a participant who arrived with a PIN or a QR code.
  const canStartRoom = roomIsPossible && !needsAccount;

  // Every tool opens on its cover, full-bleed rather than inside the padded
  // column the tool itself sits in.
  if (tool && Tool && startedId !== tool.id) {
    return (
      <ToolCover t={t} tool={tool}
        onStart={() => setStartedId(tool.id)}
        onBack={() => navigate('/toolkit')} />
    );
  }

  return (
    <div style={{ width: '100%', height: '100%', overflowY: 'auto', background: t.page,
      padding: tool && Tool ? '48px 40px 80px' : '0 40px 80px' }}>
      {!(tool && Tool) && (
        <PageHeader t={t} icon="flask" label="Methods for shaping shared spaces" title="Toolkit"
          actions={(
            <Btn t={t} variant="outline" icon="arrowRight" onClick={() => setContributing(true)}>
              Contribute
            </Btn>
          )} />
      )}
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {tool && Tool ? (
          <ToolLayout
            t={t}
            tool={tool}
            onBack={() => navigate('/toolkit')}
            actions={canStartRoom ? (
              <StartRoom t={t} tool={tool} onStart={room.start} busy={room.status === 'opening'}
                canStayOpen={Boolean(projectId)} />
            ) : roomIsPossible ? (
              <StartRoomSignedOut t={t} onSignIn={onSignIn} />
            ) : null}>
            <RoomBar t={t} tool={tool} room={room} />
            <Tool t={t} tool={tool} room={room} />
          </ToolLayout>
        ) : (
          <>
            <p style={{ fontSize: 18, color: t.inkDim, lineHeight: 1.6, maxWidth: 680, marginBottom: 40 }}>
              Participatory placemaking methods from organisations around the world, as
              tools you can use: to understand how a place is used, to imagine how it
              could change, and to plan that change in one place.
            </p>

            {missing && (
              <p role="status" style={{ marginBottom: 24, padding: '12px 16px', borderRadius: 12,
                background: t.surfaceAlt, border: `1px solid ${t.line}`, fontSize: 14, color: t.ink }}>
                There is no tool called <span className="placer-mono">{missing}</span>. Here is everything there is.
              </p>
            )}

            <ToolFilters t={t} filters={filters} onChange={setFilters} />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
              flexWrap: 'wrap', marginBottom: 24 }}>
              <p aria-live="polite" style={{ fontSize: 14, color: t.inkDim,
                display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                {filtering
                  ? `${matching.length} of ${TOOLS.length} tools`
                  : `${TOOLS.length} tools`}
                {filtering && (
                  <Btn t={t} variant="ghost" size="sm" onClick={() => setFilters(NO_FILTERS)}>
                    Clear filters
                  </Btn>
                )}
              </p>
              <ViewToggle t={t} view={view} onChange={changeView} />
            </div>

            {matching.length === 0 && (
              <div style={{ textAlign: 'center', padding: '64px 20px', color: t.inkDim }}>
                <Icon name="search" size={40} stroke={1.6} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
                <p style={{ fontSize: 16, marginBottom: 16 }}>No tools match those filters.</p>
                <Btn t={t} variant="outline" onClick={() => setFilters(NO_FILTERS)}>Clear filters</Btn>
              </div>
            )}

            {matching.length > 0 && view === 'grid' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
                {matching.map((entry) => (
                  <Tile key={entry.id} t={t} tool={entry} onOpen={() => navigate(`/toolkit/${entry.id}`)} />
                ))}
              </div>
            )}

            {matching.length > 0 && view === 'list' && (
              <div style={{ borderTop: `1px solid ${t.line}` }}>
                {matching.map((entry) => (
                  <Row key={entry.id} t={t} tool={entry} onOpen={() => navigate(`/toolkit/${entry.id}`)} />
                ))}
              </div>
            )}

            {contributing && (
              <ContributeToolDialog t={t} onClose={() => setContributing(false)} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default ToolkitPage;
