/* PLACER — Toolkit: setting up a Desire Lines room.
 *
 * The organiser of a project names the sites people are asked to draw on, and may put
 * a question to them ("How do you cross the square?"). Each site is found on the map
 * and framed, as for Site-Specific Spatial Mapping (SiteScope.jsx): everybody then
 * draws on the view the organiser framed. They may also name kinds of thing to mark
 * besides entrances and obstacles, and mark the ones they already know of on each
 * site, which everyone then sees. This only edits the setup.
 */

import { useEffect, useId, useMemo, useState } from 'react';
import { Btn, Chip } from '../UI';
import { SiteScopePicker, isFramed } from './SiteScope';
import { DesireLinesMap } from './DesireLinesMap';
import { CHARACTER } from '../../theme';
import { useIdentity } from '../useIdentity';
import { readInquiries } from '../../services/inquiries';
import {
  BASE_TYPES, MAX_ELEMENTS_PER_SITE, MAX_ELEMENT_NOTE, MAX_LABEL, MAX_NOTE, MAX_PROMPT, addInquiry, MAX_SITES, MAX_SITE_NAME, MAX_TYPES, elementName,
  makeElement, makeSite, paletteOf, typesOf,
} from '../../lib/desireLines';

function AddSite({ t, tool, onAdd }) {
  const id = useId();
  const [scope, setScope] = useState(null);
  const [address, setAddress] = useState('');
  const [name, setName] = useState('');
  const field = {
    width: '100%', height: 44, padding: '0 14px', borderRadius: 12, border: `1px solid ${t.lineStrong}`,
    background: t.surface, color: t.ink, fontFamily: 'var(--placer-font)', fontSize: 15, boxSizing: 'border-box',
  };

  return (
    <div style={{ padding: 16, borderRadius: 12, background: t.chrome }}>
      <label htmlFor={`${id}-name`} style={{ display: 'block', fontSize: 14, fontWeight: 700, color: t.ink, marginBottom: 8 }}>
        Site name
      </label>
      <input id={`${id}-name`} type="text" maxLength={MAX_SITE_NAME} value={name} style={field}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => { if (event.key === 'Enter') event.preventDefault(); }} placeholder="The market square" />
      <div style={{ height: 16 }} />
      <SiteScopePicker t={t} scope={scope} onChange={setScope} address={address} onAddress={setAddress}
        onPlace={(result) => setName((current) => current || result.name || result.label)}
        color={tool.color} fieldStyle={field}
        frameHint="Drag and zoom until the map shows the whole site. Everybody taking part draws on exactly this view." />
      <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
        <Btn t={t} variant="primary" size="sm" icon="plus" type="button" disabled={!isFramed(scope) || !name.trim()}
          onClick={() => onAdd(name, scope)}>
          Add this site
        </Btn>
      </div>
    </div>
  );
}

/** The entrances, obstacles and so on the organiser knows of on a site, put on its map. */
function SiteElements({ t, tool, site, palette, onChange }) {
  const [placing, setPlacing] = useState('entrance');
  const [described, setDescribed] = useState('');
  const kinds = palette.filter((type) => !type.blank);
  const kind = kinds.find((type) => type.id === placing) ?? kinds[0];
  const scope = useMemo(() => ({ point: site.point, zoom: site.zoom, bounds: site.bounds }), [site]);
  const colors = {
    aligned: tool.color, differs: CHARACTER.citizen.c700, others: '#6E6E6E',
    entrance: tool.color, obstacle: CHARACTER.citizen.c700, other: '#111111',
  };
  const placed = site.elements ?? [];
  const shown = placed.map((element) => ({
    ...element, tone: 'fixed', name: elementName(element, palette),
    initial: (palette.find((type) => type.id === element.type)?.initial ?? '?'),
  }));
  const set = (elements) => onChange({ ...site, elements });

  const place = (point) => {
    const label = kind.id === 'entrance' || kind.id === 'obstacle' ? '' : kind.label;
    const element = makeElement(kind.id, label, point, undefined, described);
    if (element && placed.length < MAX_ELEMENTS_PER_SITE) {
      set([...placed, element]);
      setDescribed('');
    }
  };

  return (
    <div style={{ marginTop: 12 }}>
      <div role="group" aria-label={`Mark on ${site.name}`} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        {kinds.map((type) => (
          <Chip key={type.id} t={t} active={kind.id === type.id} color={tool.color} ariaPressed={kind.id === type.id}
            onClick={() => setPlacing(type.id)}>
            {type.label}
          </Chip>
        ))}
      </div>
      <input aria-label={`Describe it, on ${site.name}`} type="text" maxLength={MAX_ELEMENT_NOTE} value={described}
        onChange={(event) => setDescribed(event.target.value)}
        onKeyDown={(event) => { if (event.key === 'Enter') event.preventDefault(); }}
        placeholder="Describe it (optional) — shown when somebody hovers over it"
        style={{ width: '100%', boxSizing: 'border-box', height: 36, padding: '0 12px', borderRadius: 12, marginBottom: 10,
          border: `1px solid ${t.lineStrong}`, background: t.surface, color: t.ink, fontFamily: 'var(--placer-font)',
          fontSize: 14 }} />
      <DesireLinesMap t={t} scope={scope} colors={colors} others={[]} runs={[]} draft={[]} mode="place"
        elements={shown} onDraft={() => {}} onFinish={() => {}} onPlace={place}
        label={`${site.name}. Tap the map to mark a ${kind.label.toLowerCase()}.`} />
      <p style={{ fontSize: 12.5, color: t.inkDim, margin: '8px 0 0' }}>
        Tap the map to mark a {kind.label.toLowerCase()}. Everybody will see it.
      </p>
      {placed.length > 0 && (
        <ol aria-label={`Marked on ${site.name}`} style={{ listStyle: 'none', margin: '8px 0 0', padding: 0 }}>
          {placed.map((element) => (
            <li key={element.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0' }}>
              <span style={{ flex: 1, fontSize: 14, color: t.ink }}>{elementName(element, palette)}</span>
              <Btn t={t} variant="ghost" size="sm" icon="trash" type="button"
                ariaLabel={`Remove ${elementName(element, palette)} from ${site.name}`}
                onClick={() => set(placed.filter((other) => other.id !== element.id))} />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** Starting from, or adding, an inquiry the signed-in organiser kept on their profile. */
function FromInquiry({ t, setup, onChange }) {
  const { status } = useIdentity();
  const [inquiries, setInquiries] = useState([]);
  const [picked, setPicked] = useState('');
  const id = useId();

  useEffect(() => {
    if (status !== 'signedIn') return undefined;
    let cancelled = false;
    readInquiries('desire-lines')
      .then((found) => { if (!cancelled) setInquiries(found); })
      .catch((err) => console.error('Could not load your saved inquiries:', err));
    return () => { cancelled = true; };
  }, [status]);

  if (status !== 'signedIn' || inquiries.length === 0) return null;
  const chosen = inquiries.find((inquiry) => inquiry.id === picked);

  return (
    <div style={{ padding: 16, borderRadius: 12, background: t.chrome }}>
      <label htmlFor={`${id}-inquiry`} style={{ display: 'block', fontSize: 14, fontWeight: 700, color: t.ink, marginBottom: 6 }}>
        Start from one of your saved inquiries
      </label>
      <div style={{ display: 'flex', gap: 8 }}>
        <select id={`${id}-inquiry`} value={picked} onChange={(event) => setPicked(event.target.value)}
          style={{ flex: 1, height: 40, padding: '0 12px', borderRadius: 12, border: `1px solid ${t.lineStrong}`,
            background: t.surface, color: t.ink, fontFamily: 'var(--placer-font)', fontSize: 15 }}>
          <option value="">Choose one…</option>
          {inquiries.map((inquiry) => <option key={inquiry.id} value={inquiry.id}>{inquiry.title}</option>)}
        </select>
        <Btn t={t} variant="quiet" size="sm" icon="plus" type="button" disabled={!chosen}
          onClick={() => { onChange(addInquiry(setup, chosen.config)); setPicked(''); }}>
          Add its site
        </Btn>
      </div>
      <span style={{ display: 'block', fontSize: 12.5, color: t.inkDim, marginTop: 6 }}>
        Adds its site and the marks you put on it, and its note about why it matters.
      </span>
    </div>
  );
}

/** The kinds of thing to mark that the organiser adds to entrances and obstacles. */
function Types({ t, setup, onChange }) {
  const id = useId();
  const [name, setName] = useState('');
  const types = typesOf(setup);
  const add = () => {
    const label = name.trim().slice(0, MAX_LABEL);
    if (!label || types.length >= MAX_TYPES) return;
    let n = types.length + 1;
    while (types.some((type) => type.id === `t${n}`)) n += 1;
    onChange({ ...setup, types: [...types, { id: `t${n}`, label }] });
    setName('');
  };

  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 700, color: t.ink, marginBottom: 4 }}>Things to mark on the map</div>
      <p style={{ fontSize: 12.5, color: t.inkDim, margin: '0 0 10px', lineHeight: 1.5 }}>
        People can always mark {BASE_TYPES.filter((type) => !type.blank).map((type) => `${type.label.toLowerCase()}s`).join(' and ')},
        and something else, which they name themselves. Add kinds of your own, like a bench or a crossing.
      </p>
      {types.length > 0 && (
        <ul aria-label="Kinds of thing to mark" style={{ listStyle: 'none', margin: '0 0 10px', padding: 0 }}>
          {types.map((type) => (
            <li key={type.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0' }}>
              <span style={{ flex: 1, fontSize: 14.5, fontWeight: 600, color: t.ink }}>{type.label}</span>
              <Btn t={t} variant="ghost" size="sm" icon="trash" type="button" ariaLabel={`Remove ${type.label}`}
                onClick={() => onChange({ ...setup, types: types.filter((other) => other.id !== type.id) })} />
            </li>
          ))}
        </ul>
      )}
      {types.length < MAX_TYPES && (
        <div style={{ display: 'flex', gap: 8 }}>
          <input id={`${id}-type`} aria-label="Name a kind of thing" type="text" maxLength={MAX_LABEL} value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); add(); } }}
            placeholder="Bench"
            style={{ flex: 1, height: 40, padding: '0 14px', borderRadius: 12, border: `1px solid ${t.lineStrong}`,
              background: t.surface, color: t.ink, fontFamily: 'var(--placer-font)', fontSize: 15 }} />
          <Btn t={t} variant="quiet" size="sm" icon="plus" type="button" disabled={!name.trim()} onClick={add}>
            Add kind
          </Btn>
        </div>
      )}
    </div>
  );
}

export function DesireLinesSetup({ t, tool, setup, onChange }) {
  const id = useId();
  const sites = setup.sites ?? [];
  const palette = paletteOf(setup);
  const [marking, setMarking] = useState(null);
  // A new picker for each site added, so the next one starts from nothing.
  const [added, setAdded] = useState(0);

  const add = (name, scope) => {
    onChange({ ...setup, sites: [...sites, makeSite(sites, name, scope)] });
    setAdded((count) => count + 1);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label htmlFor={`${id}-prompt`} style={{ fontSize: 14, fontWeight: 700, color: t.ink }}>
          What do you want to know? (optional)
        </label>
        <input id={`${id}-prompt`} type="text" maxLength={MAX_PROMPT} value={setup.prompt ?? ''}
          onChange={(event) => onChange({ ...setup, prompt: event.target.value })}
          onKeyDown={(event) => { if (event.key === 'Enter') event.preventDefault(); }}
          placeholder="Which way do you really walk across the square?"
          style={{ height: 44, padding: '0 14px', borderRadius: 12, border: `1px solid ${t.lineStrong}`,
            background: t.surface, color: t.ink, fontFamily: 'var(--placer-font)', fontSize: 15 }} />
        <span style={{ fontSize: 12.5, color: t.inkDim }}>Shown above the map on the project&rsquo;s page.</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label htmlFor={`${id}-note`} style={{ fontSize: 14, fontWeight: 700, color: t.ink }}>
          Why are you interested in the site? (optional)
        </label>
        <textarea id={`${id}-note`} rows={3} maxLength={MAX_NOTE} value={setup.note ?? ''}
          onChange={(event) => onChange({ ...setup, note: event.target.value })}
          placeholder="What you want to learn about how people move around here."
          style={{ padding: 14, borderRadius: 12, border: `1px solid ${t.lineStrong}`, background: t.surface,
            color: t.ink, fontFamily: 'var(--placer-font)', fontSize: 15, lineHeight: 1.5, resize: 'vertical' }} />
        <span style={{ fontSize: 12.5, color: t.inkDim }}>Shown beside the map on the project&rsquo;s page.</span>
      </div>

      <FromInquiry t={t} setup={setup} onChange={onChange} />

      <Types t={t} setup={setup} onChange={onChange} />

      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: t.ink, marginBottom: 8 }}>
          Sites ({sites.length} of {MAX_SITES})
        </div>
        {sites.length > 0 && (
          <ol aria-label="Sites" style={{ listStyle: 'none', margin: '0 0 16px', padding: 0 }}>
            {sites.map((site) => (
              <li key={site.id} style={{ padding: '8px 0', borderBottom: `1px solid ${t.line}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ flex: 1, fontSize: 14.5, fontWeight: 600, color: t.ink, overflowWrap: 'anywhere' }}>
                    {site.name}
                    {(site.elements?.length ?? 0) > 0 && (
                      <span style={{ fontWeight: 400, color: t.inkDim }}> &middot; {site.elements.length} marked</span>
                    )}
                  </span>
                  <Btn t={t} variant="quiet" size="sm" icon="pin" type="button" ariaPressed={marking === site.id}
                    ariaLabel={`Mark things on ${site.name}`}
                    onClick={() => setMarking(marking === site.id ? null : site.id)}>
                    Mark things
                  </Btn>
                  <Btn t={t} variant="ghost" size="sm" icon="trash" type="button" ariaLabel={`Remove ${site.name}`}
                    onClick={() => onChange({ ...setup, sites: sites.filter((other) => other.id !== site.id) })} />
                </div>
                {marking === site.id && (
                  <SiteElements t={t} tool={tool} site={site} palette={palette}
                    onChange={(next) => onChange({ ...setup, sites: sites.map((other) => (other.id === site.id ? next : other)) })} />
                )}
              </li>
            ))}
          </ol>
        )}
        {sites.length < MAX_SITES
          ? <AddSite key={added} t={t} tool={tool} onAdd={add} />
          : <p style={{ fontSize: 13.5, color: t.inkDim, margin: 0 }}>That is the most sites a room can ask about.</p>}
      </div>
    </div>
  );
}

export default DesireLinesSetup;
