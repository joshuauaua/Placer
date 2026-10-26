/* PLACER — Toolkit: Desire Lines.
 *
 * The path people take, not the one that got paved. Pick a site on the map and draw
 * the walks you really make across it.
 *
 * On its own, the tool starts by choosing the site — search for a place or pan and zoom
 * the map to it, then Use this site, which fixes that view — and saying why the site is
 * of interest, which stays beside the map. Then you draw. Nothing is saved unless you
 * are signed in and keep it on your profile as an inquiry (services/inquiries.js), to
 * start a project's Desire Lines from later; or download it.
 *
 * Run for a project, in a room its organiser opened (`room.config`, see `setup` in
 * toolkit/tools/desire-lines.js), the sites are the ones they chose, and what everybody
 * draws goes to the room. Anybody may then choose to lay the others' walks over their
 * own — hidden to begin with — and see where they follow them and where they do not.
 *
 * The board is DesireLinesBoard, the map DesireLinesMap, the geometry
 * src/lib/desireLines.js.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Panel } from '../ToolLayout';
import { Btn } from '../UI';
import { SiteScopePicker, isFramed } from './SiteScope';
import { DesireLinesBoard } from './DesireLinesBoard';
import { KeepOnProfile } from './KeepOnProfile';
import {
  MAX_NOTE, MAX_SITE_NAME, SOLO_SITE, elementsOthersOn, inquiryConfig, emptyDesire, othersOn as othersOnSite, paletteOf, sitesOf,
} from '../../lib/desireLines';

function fieldStyle(t) {
  return {
    width: '100%', height: 48, padding: '0 14px', borderRadius: 12, border: `1px solid ${t.lineStrong}`,
    background: t.surface, color: t.ink, fontFamily: 'var(--placer-font)', fontSize: 15, boxSizing: 'border-box',
  };
}

/** The first thing the tool asks: where. */
function ChooseSite({ t, tool, onChoose }) {
  const [scope, setScope] = useState(null);
  const [address, setAddress] = useState('');
  const [name, setName] = useState('');
  const [note, setNote] = useState('');

  return (
    <Panel t={t} title="Choose your site">
      <label htmlFor="desire-lines-name" style={{ display: 'block', fontSize: 14, fontWeight: 700, color: t.ink,
        marginBottom: 8 }}>
        Site name
      </label>
      <input id="desire-lines-name" type="text" value={name} maxLength={MAX_SITE_NAME} style={fieldStyle(t)}
        onChange={(event) => setName(event.target.value)} placeholder="The market square" />
      <div style={{ height: 20 }} />
      <SiteScopePicker
        t={t}
        scope={scope}
        onChange={setScope}
        address={address}
        onAddress={setAddress}
        onPlace={(result) => setName((current) => current || result.name || result.label)}
        color={tool.color}
        fieldStyle={fieldStyle(t)}
        aspect="10 / 4.2"
        between={(
      <div style={{ marginTop: 20 }}>
        <label htmlFor="desire-lines-note" style={{ display: 'block', fontSize: 14, fontWeight: 700, color: t.ink,
          marginBottom: 6 }}>
          Why are you interested in this site? (optional)
        </label>
        <textarea id="desire-lines-note" value={note} maxLength={MAX_NOTE} rows={4}
          onChange={(event) => setNote(event.target.value)}
          placeholder="What you have noticed, or want to find out, about how people move here."
          style={{ ...fieldStyle(t), height: 'auto', padding: 14, lineHeight: 1.5, resize: 'vertical' }} />
        <span style={{ display: 'block', fontSize: 12.5, color: t.inkDim, marginTop: 4 }}>
          Shown beside the map, and kept with the site if you save it to your profile.
        </span>
      </div>
        )}
        frameHint="Search for the place, or drag and zoom the map to it, until it shows the site you want to draw on. You can still move around once you start."
      />
      <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
        <Btn t={t} variant="primary" icon="pin" disabled={!isFramed(scope)}
          onClick={() => onChoose({ name: name || address.trim() || 'Your site', scope, note: note.trim() })}>
          Use this site
        </Btn>
      </div>
    </Panel>
  );
}

/** The tool on its own: choose a site, then draw on it. */
function Solo({ t, tool }) {
  const [site, setSite] = useState(null);
  const [state, setState] = useState(emptyDesire);

  if (!site) return <ChooseSite t={t} tool={tool} onChoose={setSite} />;

  return (
    <DesireLinesBoard
      t={t}
      tool={tool}
      sites={[{ id: SOLO_SITE, name: site.name, scope: site.scope }]}
      state={state}
      onChange={setState}
      about={site.note || null}
      footer={(
        <>
          <KeepOnProfile t={t} tool="desire-lines"
            inquiry={{ title: site.name, note: site.note ?? '', config: inquiryConfig({ site, note: site.note, state }) }}
            intro="Save this site, your marks and your walks on your profile as an inquiry, to start or add to a project's Desire Lines later." />
          <Btn t={t} variant="quiet" size="sm" icon="pin" onClick={() => { setSite(null); setState(emptyDesire()); }}>
            Choose another site
          </Btn>
        </>
      )}
    />
  );
}

/** A project's room: its sites, with everybody's walks going to the room. */
function InRoom({ t, tool, room }) {
  const sites = useMemo(
    () => sitesOf(room.config).map((site) => ({
      id: site.id, name: site.name, elements: site.elements,
      scope: { point: site.point, zoom: site.zoom, bounds: site.bounds },
    })),
    [room.config],
  );
  const palette = useMemo(() => paletteOf(room.config), [room.config]);
  const [state, setState] = useState(emptyDesire);
  // Held in a ref: the room object is rebuilt on every render, so depending on it would
  // publish again on every change that comes in.
  const roomRef = useRef(room);
  roomRef.current = room;
  const touched = useRef(false);

  const change = (next) => {
    touched.current = true;
    setState(next);
  };

  useEffect(() => {
    const current = roomRef.current;
    if (touched.current && current?.status === 'open') current.publish(state);
  }, [state]);

  const combined = room.status === 'open' ? room.combined : null;
  const othersOn = useCallback((siteId, mine) => ({
    paths: othersOnSite(combined, siteId, mine.paths),
    elements: elementsOthersOn(combined, siteId, mine.elements),
  }), [combined]);

  if (sites.length === 0) {
    return (
      <Panel t={t} title="Desire Lines">
        <p style={{ fontSize: 14, color: t.inkDim, lineHeight: 1.6, margin: 0 }}>
          This room was opened without a site to draw on.
        </p>
      </Panel>
    );
  }

  return (
    <DesireLinesBoard
      t={t}
      tool={tool}
      sites={sites}
      state={state}
      onChange={change}
      othersOn={combined ? othersOn : null}
      palette={palette}
      about={room.config?.note || null}
    />
  );
}

export function DesireLines({ t, tool, room = null }) {
  return room?.config
    ? <InRoom t={t} tool={tool} room={room} />
    : <Solo t={t} tool={tool} />;
}

export default DesireLines;
