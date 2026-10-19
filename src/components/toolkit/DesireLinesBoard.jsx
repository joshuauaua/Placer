/* PLACER — Toolkit: the board Desire Lines are drawn on.
 *
 * The map of a site, the ways to draw on it and what has been drawn — shared by the
 * tool's own page (DesireLines) and a project's page (DesireLinesOnPage), which differ
 * in where the sites and the other walks come from and where this person's own go.
 *
 * `sites` is [{ id, name, scope, elements }] — `elements` the entrances and the like the
 * organiser put on the site themselves — `state` this person's walks and elements
 * (lib/desireLines.js) and `onChange(state)` hears of every change. `palette` is the
 * kinds of element that can be placed. `othersOn(siteId, { paths, elements })` gives
 * what everyone else drew and placed on a site, as { paths, elements } (less this
 * person's own, which it is handed), or is left out when there is nobody to compare
 * with — and then so is the choice to see them. Those are hidden to begin with: drawing is
 * better done from memory than from what the last person drew.
 */

import { useId, useMemo, useState } from 'react';
import { Panel, Readout } from '../ToolLayout';
import { Btn, Chip } from '../UI';
import { DesireLinesMap } from './DesireLinesMap';
import { PALETTE, PALETTE_LIST } from '../../theme';
import {
  MAX_ELEMENT_NOTE, MAX_LABEL, addElement, addPath, alignment, clearSite, compare, elementName, elementsOf, makeElement, makePath,
  pathLength, pathsOf, removeElement, removePath, toGeoJSON, BASE_TYPES,
} from '../../lib/desireLines';

// One colour for each walk, so they can be told apart: the brand's three hues, each in the
// two tones dark enough to read on the map, cycling after six.
const WALK_COLORS = PALETTE_LIST.flatMap((colour) => [colour.c700]).concat(
  PALETTE_LIST.map((colour) => colour.c900),
);
export const walkColor = (index) => WALK_COLORS[index % WALK_COLORS.length];

const PLACE_HINT = 'Tap the map where it is.';
const MODES = [
  { id: 'freehand', label: 'Draw freehand', hint: 'Drag across the map along the way you walk.' },
  { id: 'points', label: 'Point by point', hint: 'Tap along the way you walk, then finish the walk.' },
  { id: 'move', label: 'Move the map', hint: 'Pan and zoom without drawing.' },
];

const metres = (value) => `${Math.round(value).toLocaleString('en')} m`;

function download(name, json) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(json, null, 2)], { type: 'application/geo+json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

export function DesireLinesBoard({
  t, tool, sites, state, onChange, othersOn = null, disabled = false, footer = null, palette = BASE_TYPES, about = null,
}) {
  const [siteId, setSiteId] = useState(sites[0]?.id);
  const [mode, setMode] = useState('freehand');
  const [draft, setDraft] = useState([]);
  const [showOthers, setShowOthers] = useState(false);
  const [placing, setPlacing] = useState('entrance');
  const [blank, setBlank] = useState('');
  const [described, setDescribed] = useState('');
  // What was added, in order, so Undo takes back the latest: { siteId, kind, id }.
  const [history, setHistory] = useState([]);
  const labelId = useId();
  const site = sites.find((candidate) => candidate.id === siteId) ?? sites[0];
  const mine = pathsOf(state, site.id);
  const myElements = elementsOf(state, site.id);
  const found = useMemo(
    () => (othersOn ? othersOn(site.id, { paths: mine, elements: myElements }) : { paths: [], elements: [] }),
    [othersOn, site.id, mine, myElements],
  );
  const theirs = found.paths;
  const comparing = showOthers && theirs.length > 0;
  const colors = {
    aligned: tool.color, differs: PALETTE.orange.c700, others: '#6E6E6E',
    entrance: tool.color, obstacle: PALETTE.orange.c700, other: '#111111',
  };
  const placingType = palette.find((type) => type.id === placing) ?? palette[0];
  const needsName = Boolean(placingType.blank);

  // Everything on the map, whoever put it there, as the map draws it.
  const shown = useMemo(() => {
    const draw = (list, tone) => list.map((element) => {
      const name = elementName(element, palette);
      const kind = palette.find((type) => type.id === element.type);
      return { ...element, tone, name, initial: (kind?.blank ? name : kind?.initial ?? name)[0].toUpperCase() };
    });
    return [
      ...draw(site.elements ?? [], 'fixed'),
      ...draw(myElements, 'mine'),
      ...draw(showOthers ? found.elements : [], 'others'),
    ];
  }, [site.elements, myElements, found.elements, showOthers, palette]);

  const runs = useMemo(
    () => mine.flatMap((path, index) => (comparing ? compare(path, theirs) : [{ points: path.points, aligned: true }])
      .map((run) => ({ ...run, color: walkColor(index) }))),
    [mine, theirs, comparing],
  );
  const result = useMemo(() => (comparing ? alignment(mine, theirs) : null), [comparing, mine, theirs]);
  const drawn = useMemo(() => mine.reduce((sum, path) => sum + pathLength(path.points), 0), [mine]);

  const finish = (points) => {
    const path = makePath(points);
    setDraft([]);
    if (!path) return;
    onChange(addPath(state, site.id, path));
    setHistory((past) => [...past, { siteId: site.id, kind: 'path', id: path.id }]);
  };

  // A point of the walk being drawn, or else the last walk or mark added on this site.
  const lastHere = [...history].reverse().find((entry) => entry.siteId === site.id);
  const undo = () => {
    if (draft.length > 0) {
      setDraft((points) => points.slice(0, -1));
      return;
    }
    if (!lastHere) return;
    setHistory((past) => past.filter((entry) => entry !== lastHere));
    onChange(lastHere.kind === 'path'
      ? removePath(state, site.id, lastHere.id)
      : removeElement(state, site.id, lastHere.id));
  };

  const pick = (id) => {
    setSiteId(id);
    setDraft([]);
  };

  const chooseMode = (id) => {
    setMode(id);
    setDraft([]);
  };

  const choosePlacing = (id) => {
    setPlacing(id);
    chooseMode('place');
  };

  const place = (point) => {
    const label = placingType.blank ? blank : placingType.id === 'entrance' || placingType.id === 'obstacle' ? '' : placingType.label;
    const element = makeElement(placingType.id, label, point, undefined, described);
    if (!element) return;
    onChange(addElement(state, site.id, element));
    setHistory((past) => [...past, { siteId: site.id, kind: 'element', id: element.id }]);
    if (placingType.blank) setBlank('');
    setDescribed('');
  };

  const hint = mode === 'place'
    ? (needsName && !blank.trim() ? 'Say what it is, then tap the map where it is.' : `${PLACE_HINT} Hover over it later to read its description.`)
    : MODES.find((m) => m.id === mode).hint;
  const label = `${site.name}. ${hint}`;

  return (
    <div className="placer-desire">
      <Panel t={t} title={site.name} aside={
        <span className="placer-mono" style={{ fontSize: 12, color: t.inkDim }}>
          {mine.length} {mine.length === 1 ? 'walk' : 'walks'} drawn
          {myElements.length > 0 && ` \u00b7 ${myElements.length} marked`}
        </span>
      }>
        {sites.length > 1 && (
          <div role="group" aria-label="Sites" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            {sites.map((candidate) => (
              <Chip key={candidate.id} t={t} active={candidate.id === site.id} color={tool.color}
                ariaPressed={candidate.id === site.id} onClick={() => pick(candidate.id)}>
                {candidate.name}
              </Chip>
            ))}
          </div>
        )}

        <div role="group" aria-label="How to draw" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {MODES.map((option) => (
            <Chip key={option.id} t={t} active={mode === option.id} color={tool.color} ariaPressed={mode === option.id}
              title={option.hint} onClick={() => chooseMode(option.id)}>
              {option.label}
            </Chip>
          ))}
        </div>

        <div role="group" aria-label="Put on the map" style={{ display: 'flex', gap: 8, flexWrap: 'wrap',
          alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: t.inkDim }}>Mark</span>
          {palette.map((type) => (
            <Chip key={type.id} t={t} active={mode === 'place' && placing === type.id} color={tool.color}
              ariaPressed={mode === 'place' && placing === type.id} onClick={() => choosePlacing(type.id)}>
              {type.label}
            </Chip>
          ))}
          {mode === 'place' && (
            <input aria-label="Describe it" type="text" maxLength={MAX_ELEMENT_NOTE} value={described}
              onChange={(event) => setDescribed(event.target.value)} placeholder="Describe it (optional)"
              style={{ height: 32, padding: '0 10px', borderRadius: 12, border: `1px solid ${t.lineStrong}`,
                background: t.surface, color: t.ink, fontFamily: 'var(--placer-font)', fontSize: 14, minWidth: 180 }} />
          )}
          {mode === 'place' && needsName && (
            <input aria-label="What is it?" id={labelId} type="text" maxLength={MAX_LABEL} value={blank}
              onChange={(event) => setBlank(event.target.value)} placeholder="What is it? e.g. Bench"
              style={{ height: 32, padding: '0 10px', borderRadius: 12, border: `1px solid ${t.lineStrong}`,
                background: t.surface, color: t.ink, fontFamily: 'var(--placer-font)', fontSize: 14, minWidth: 160 }} />
          )}
        </div>

        <DesireLinesMap
          key={site.id}
          t={t}
          scope={site.scope}
          others={comparing ? theirs : []}
          runs={runs}
          draft={draft}
          draftColor={walkColor(mine.length)}
          mode={disabled ? 'move' : mode}
          onDraft={setDraft}
          onFinish={finish}
          elements={shown}
          colors={colors}
          onPlace={place}
          label={label}
        />

        <p style={{ margin: '10px 0 0', fontSize: 12.5, color: t.inkDim, lineHeight: 1.6 }}>{hint}</p>

        <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {mode === 'points' && (
            <>
              <Btn t={t} variant="primary" size="sm" icon="check" disabled={draft.length < 2}
                onClick={() => finish(draft)}>
                Finish walk
              </Btn>
            </>
          )}
          <Btn t={t} variant="quiet" size="sm" icon="undo" disabled={draft.length === 0 && !lastHere}
            title={draft.length > 0 ? 'Take back the last point' : 'Take back the last walk or mark'}
            onClick={undo}>
            Undo
          </Btn>
          {othersOn && (
            <Btn t={t} variant="quiet" size="sm" icon="layers" ariaPressed={showOthers}
              style={showOthers ? { borderColor: tool.color, color: tool.color } : undefined}
              onClick={() => setShowOthers((shown) => !shown)}>
              {showOthers ? 'Hide other people’s walks' : 'Show other people’s walks'}
            </Btn>
          )}
          <div style={{ flex: 1 }} />
          <Btn t={t} variant="quiet" size="sm" icon="rotate" disabled={mine.length === 0 && myElements.length === 0 && draft.length === 0}
            onClick={() => { setDraft([]); onChange(clearSite(state, site.id)); }}>
            Clear
          </Btn>
        </div>
      </Panel>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
        {about && (
          <Panel t={t} title="About this site">
            <p style={{ fontSize: 14, color: t.ink, lineHeight: 1.65, margin: 0, whiteSpace: 'pre-line',
              overflowWrap: 'anywhere' }}>
              {about}
            </p>
          </Panel>
        )}
        <Panel t={t} title="Your walks">
          {mine.length === 0 && myElements.length === 0 ? (
            <p style={{ fontSize: 13.5, color: t.inkDim, lineHeight: 1.65, margin: 0 }}>
              Nothing yet. Draw the ways you really walk across {site.name} &mdash; the shortcuts and the
              detours around what was built, not the paths on the plan.
            </p>
          ) : (
            <>
              <Readout t={t} label="Drawn" value={Math.round(drawn)} unit="m" />
              <ol aria-label="Your walks" style={{ listStyle: 'none', margin: '14px 0 0', padding: 0 }}>
                {mine.map((path, index) => (
                  <li key={path.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0',
                    borderBottom: `1px solid ${t.line}` }}>
                    <Swatch color={walkColor(index)} />
                    <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: t.ink }}>Walk {index + 1}</span>
                    <span className="placer-mono" style={{ fontSize: 12, color: t.inkDim }}>
                      {metres(pathLength(path.points))}
                    </span>
                    <Btn t={t} variant="ghost" size="sm" icon="trash" ariaLabel={`Remove walk ${index + 1}`}
                      onClick={() => onChange(removePath(state, site.id, path.id))} />
                  </li>
                ))}
              </ol>
              {myElements.length > 0 && (
                <ol aria-label="Your marks" style={{ listStyle: 'none', margin: '14px 0 0', padding: 0 }}>
                  {myElements.map((element) => (
                    <li key={element.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0',
                      borderBottom: `1px solid ${t.line}` }}>
                      <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: t.ink, overflowWrap: 'anywhere' }}>
                        {elementName(element, palette)}
                      </span>
                      <Btn t={t} variant="ghost" size="sm" icon="trash"
                        ariaLabel={`Remove ${elementName(element, palette)}`}
                        onClick={() => onChange(removeElement(state, site.id, element.id))} />
                    </li>
                  ))}
                </ol>
              )}
              {!othersOn && (
                <div style={{ marginTop: 14 }}>
                  <Btn t={t} variant="quiet" size="sm" icon="link"
                    onClick={() => download(`${site.name.replace(/\W+/g, '-').toLowerCase()}-desire-lines.geojson`,
                      toGeoJSON(mine, { site: site.name }, myElements))}>
                    Download as GeoJSON
                  </Btn>
                </div>
              )}
            </>
          )}
        </Panel>

        {othersOn && (
          <Panel t={t} title="Against everyone else">
            {!showOthers ? (
              <p style={{ fontSize: 13.5, color: t.inkDim, lineHeight: 1.65, margin: 0 }}>
                Draw first, then show what other people drew to see where you walk the same way and
                where you do not.
              </p>
            ) : theirs.length === 0 ? (
              <p style={{ fontSize: 13.5, color: t.inkDim, lineHeight: 1.65, margin: 0 }}>
                Nobody else has drawn on {site.name} yet.
              </p>
            ) : (
              <>
                <p style={{ fontSize: 13.5, color: t.inkDim, lineHeight: 1.65, margin: '0 0 14px' }}>
                  {theirs.length} {theirs.length === 1 ? 'walk' : 'walks'} by other people, in grey &mdash; it
                  darkens where many walked.
                </p>
                {result && result.total > 0 ? (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
                      <Readout t={t} label="Walked the same way" value={Math.round(result.share * 100)} unit="%" />
                      <Readout t={t} label="Your own way" value={result.total - result.shared} unit="m" />
                    </div>
                    <ul style={{ listStyle: 'none', margin: '14px 0 0', padding: 0, fontSize: 13, color: t.ink,
                      lineHeight: 1.9 }}>
                      <li><Swatch color={t.ink} /> Solid where you follow others</li>
                      <li><Swatch color={t.ink} dashed /> Dashed where you go a different way</li>
                    </ul>
                  </>
                ) : (
                  <p style={{ fontSize: 13.5, color: t.inkDim, lineHeight: 1.65, margin: 0 }}>
                    Draw a walk to see how it compares.
                  </p>
                )}
              </>
            )}
          </Panel>
        )}

        {footer}
      </div>
    </div>
  );
}

function Swatch({ color, dashed = false }) {
  return (
    <span aria-hidden="true" style={{ display: 'inline-block', width: 18, height: 0, flex: '0 0 auto',
      borderTop: `4px ${dashed ? 'dashed' : 'solid'} ${color}`, verticalAlign: 'middle', marginRight: 8 }} />
  );
}

export default DesireLinesBoard;
