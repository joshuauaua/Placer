/* PLACER — Toolkit: setting up Site-Specific Spatial Mapping for a project.
 *
 * The site, in two stages of the registry entry's `setup.steps` (SetupSteps walks
 * through them, then when the room starts and how long it stays open): what it is
 * called, then where it is — the address searched for, and the map framed around the
 * site (SiteScope.jsx). That frame is the view everybody taking part sees the site in,
 * and maps it on. These only edit the setup.
 */

import { useId } from 'react';
import { SiteScopePicker } from './SiteScope';
import { MAX_SITE_NAME } from '../../lib/toolkit/siteMapping';

const fieldStyle = (t) => ({
  width: '100%', height: 44, padding: '0 14px', borderRadius: 12, border: `1px solid ${t.lineStrong}`,
  background: t.surface, color: t.ink, fontFamily: 'var(--placer-font)', fontSize: 15, boxSizing: 'border-box',
});

/** The first stage: the site's name. */
export function SiteNameStep({ t, setup, onChange }) {
  const id = useId();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label htmlFor={`${id}-name`} style={{ fontSize: 14, fontWeight: 700, color: t.ink }}>
        Site name *
      </label>
      <span id={`${id}-name-hint`} style={{ fontSize: 13, color: t.inkDim, lineHeight: 1.5 }}>
        How do people using this tool name the site.
      </span>
      <input id={`${id}-name`} aria-describedby={`${id}-name-hint`} type="text" maxLength={MAX_SITE_NAME}
        value={setup.name ?? ''} placeholder="e.g. Lindenplatz"
        onChange={(event) => onChange({ ...setup, name: event.target.value })}
        style={{ ...fieldStyle(t), marginTop: 4 }} />
    </div>
  );
}

/** The second stage: where the site is, and the view of it everybody maps it in. */
export function SiteLocationStep({ t, tool, project = null, setup, onChange }) {
  const scope = setup.point ? { point: setup.point, zoom: setup.zoom, bounds: setup.bounds } : null;
  return (
    <SiteScopePicker t={t} scope={scope} color={tool.color} fieldStyle={fieldStyle(t)}
      startAt={project?.locationPoint ?? null}
      address={setup.address ?? ''} onAddress={(address) => onChange((current) => ({ ...current, address }))}
      onChange={(next) => onChange((current) => ({ ...current, ...next }))}
      searchLabel="Search for the address" frameLabel={null}
      frameHint="Drag and zoom until the map encompasses the whole site. Everybody using the tool will see it from exactly this view." />
  );
}

/** Both stages on one screen, for a host that does not walk through `steps`. */
export function SiteMappingSetup(props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <SiteNameStep {...props} />
      <SiteLocationStep {...props} />
    </div>
  );
}

export default SiteMappingSetup;
