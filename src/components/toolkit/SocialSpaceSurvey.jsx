import { Fragment, useMemo, useState } from 'react';
import { Icon } from '../Icon';
import { Panel } from '../ToolLayout';
import { Btn, Chip, CopyButton } from '../UI';
import { DatePicker } from '../DatePicker';
import {
  HINDERING_ITEMS,
  INVITING_ITEMS,
  PATTERN_KINDS,
  RATING_OPTIONS,
  RATING_QUESTIONS,
  REFLECTION_NOTE_FIELDS,
  SPACE_TYPES,
  WEATHER_PRESETS,
  buildJSON,
  buildSummary,
  emptySurvey,
  stats,
} from '../../lib/toolkit/socialSpaceSurvey';

const STEPS = [
  { key: 'inventory', label: 'Site inventory', icon: 'check' },
  { key: 'spatial', label: 'Spatial mapping', icon: 'grid' },
  { key: 'reflection', label: 'Reflection', icon: 'comment' },
  { key: 'export', label: 'Review & export', icon: 'send' },
];

function today() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function inputField(t) {
  return {
    width: '100%', height: 42, padding: '0 12px', borderRadius: 12,
    border: `1.5px solid ${t.line}`, background: t.surfaceAlt, color: t.ink,
    fontFamily: 'var(--placer-font)', fontSize: 14.5, fontWeight: 500,
  };
}

function textField(t) {
  return {
    ...inputField(t), height: 'auto', minHeight: 72, padding: 10,
    fontWeight: 500, lineHeight: 1.5, resize: 'vertical',
  };
}

function Field({ t, id, label, children, hint }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
      <label className="placer-mono" htmlFor={id} style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
        textTransform: 'uppercase', color: t.inkDim }}>
        {label}
      </label>
      {children}
      {hint && <span style={{ fontSize: 12, color: t.inkFaint }}>{hint}</span>}
    </div>
  );
}

function Stat({ t, value, label, tone }) {
  return (
    <div style={{ background: t.surfaceAlt, borderRadius: 12, padding: '12px 14px' }}>
      <div className="placer-disp" style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.1, color: tone || t.ink }}>
        {value}
      </div>
      <div style={{ fontSize: 12, fontWeight: 500, color: t.inkDim, marginTop: 3 }}>{label}</div>
    </div>
  );
}

function Steps({ t, tool, step, done, s, onGo }) {
  const c = tool.color;
  return (
    <nav aria-label="Survey steps" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 18 }}>
      {STEPS.map((node, index) => {
        const unlocked = node.key === 'inventory' || node.key === 'export' || done;
        const active = step === node.key;
        const complete =
          node.key === 'inventory' ? done
          : node.key === 'spatial' ? s.hasSpatial
          : node.key === 'reflection' ? s.hasReflection
          : true;
        return (
          <Fragment key={node.key}>
            {index > 0 && <span style={{ flex: 1, minWidth: 14, height: 1, background: t.line }} />}
            <button
              type="button"
              onClick={() => onGo(node.key)}
              disabled={!unlocked}
              aria-current={active ? 'step' : undefined}
              title={unlocked ? node.label : `${node.label} — complete step 1 first`}
              style={{ display: 'flex', alignItems: 'center', gap: 8, height: 40, padding: '0 12px', borderRadius: 12,
                border: `1.5px solid ${active ? c : t.line}`, background: active ? c + '14' : 'transparent',
                color: active ? c : t.ink, opacity: unlocked ? 1 : 0.5,
                cursor: unlocked ? 'pointer' : 'not-allowed', fontFamily: 'var(--placer-font)', fontWeight: 700, fontSize: 13 }}>
              <span style={{ width: 18, height: 18, borderRadius: '50%', flex: '0 0 auto', display: 'flex',
                alignItems: 'center', justifyContent: 'center', background: complete ? c : 'transparent',
                border: `1.5px solid ${complete ? c : t.line}`, color: complete ? '#fff' : t.inkDim }}>
                {complete ? <Icon name="check" size={11} stroke={2.8} /> : <span style={{ fontSize: 10.5 }}>{index + 1}</span>}
              </span>
              {node.label}
            </button>
          </Fragment>
        );
      })}
    </nav>
  );
}

export function SocialSpaceSurvey({ t, tool }) {
  const c = tool.color;
  const [survey, setSurvey] = useState(() => ({
    ...emptySurvey(),
    meta: { ...emptySurvey().meta, date: today() },
  }));
  const [step, setStep] = useState('inventory');
  const [done, setDone] = useState(false);
  const s = useMemo(() => stats(survey), [survey]);

  function update(patch) {
    setSurvey((current) => ({ ...current, ...patch }));
  }

  function setMeta(key, value) {
    update({ meta: { ...survey.meta, [key]: value } });
  }

  function toggleInviting(key) {
    const entry = survey.inventory.inviting[key] || {};
    update({
      inventory: {
        ...survey.inventory,
        inviting: { ...survey.inventory.inviting, [key]: { checked: !entry.checked, detail: entry.detail || '' } },
      },
    });
  }

  function setInvitingDetail(key, detail) {
    update({
      inventory: {
        ...survey.inventory,
        inviting: {
          ...survey.inventory.inviting,
          [key]: { checked: true, detail },
        },
      },
    });
  }

  function toggleHindering(key) {
    update({
      inventory: {
        ...survey.inventory,
        hindering: { ...survey.inventory.hindering, [key]: !survey.inventory.hindering[key] },
      },
    });
  }

  function addPattern(kindKey) {
    const current = survey.spatialPatterns || {};
    update({ spatialPatterns: { ...current, [kindKey]: [...(current[kindKey] || []), { feature: '', strength: 3, note: '' }] } });
  }

  function removePattern(kindKey, index) {
    const current = survey.spatialPatterns || {};
    const next = { ...current, [kindKey]: (current[kindKey] || []).filter((_, i) => i !== index) };
    update({ spatialPatterns: PATTERN_KINDS.some((kind) => (next[kind.key] || []).length > 0) ? next : null });
  }

  function setPattern(kindKey, index, field, value) {
    const current = survey.spatialPatterns || {};
    const list = (current[kindKey] || []).map((entry, i) => (i === index ? { ...entry, [field]: value } : entry));
    update({ spatialPatterns: { ...current, [kindKey]: list } });
  }

  function setRating(key, value) {
    const current = survey.qualitativeReflection || {};
    update({ qualitativeReflection: { ...current, ratings: { ...current.ratings, [key]: value } } });
  }

  function setNote(key, value) {
    const current = survey.qualitativeReflection || {};
    update({ qualitativeReflection: { ...current, notes: { ...current.notes, [key]: value } } });
  }

  function slug(value) {
    const name = String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return name || 'site';
  }

  function downloadText(filename, text, mime) {
    const blob = new Blob([text], { type: mime });
    const url = typeof URL.createObjectURL === 'function' ? URL.createObjectURL(blob) : null;
    if (!url) return;
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  function downloadJSON() {
    downloadText(`social-space-survey-${slug(survey.meta.siteName)}.json`, buildJSON(survey), 'application/json');
  }

  function downloadSummaryFile() {
    downloadText(`social-space-survey-${slug(survey.meta.siteName)}.txt`, buildSummary(survey), 'text/plain');
  }

  function reset() {
    setSurvey({ ...emptySurvey(), meta: { ...emptySurvey().meta, date: today() } });
    setDone(false);
    setStep('inventory');
  }

  const statusLine = [survey.meta.siteName || 'This site', survey.meta.spaceType, survey.meta.date ? `observed ${[survey.meta.date, survey.meta.time].filter(Boolean).join(' at ')}` : 'date not set']
    .filter(Boolean).join(' · ');

  const summary = buildSummary(survey);
  const siteInput = inputField(t);
  const areaInput = textField(t);

  return (
    <div style={{ maxWidth: 900 }}>
      <Steps t={t} tool={tool} step={step} done={done} s={s} onGo={(key) => {
        if ((key === 'spatial' || key === 'reflection') && !done) return;
        setStep(key);
      }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        <span className="placer-mono" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: t.inkDim }}>
          Nothing is saved here — take your data when you go
        </span>
        <div style={{ flex: 1 }} />
        <Btn t={t} variant="outline" size="sm" onClick={downloadJSON}>Download JSON</Btn>
        <Btn t={t} variant="outline" size="sm" onClick={downloadSummaryFile}>Download summary (.txt)</Btn>
      </div>

      {step === 'inventory' && (done ? (
        <div role="status" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', background: c + '12',
            border: `1.5px solid ${c + '55'}`, borderRadius: 12, padding: '16px 18px' }}>
            <span style={{ width: 34, height: 34, borderRadius: '50%', background: c, color: '#fff', flex: '0 0 auto',
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="check" size={18} stroke={2.8} />
            </span>
            <div>
              <div style={{ fontSize: 17, fontWeight: 700, color: t.ink, letterSpacing: '-0.02em' }}>
                Step 1 recorded — this space is in your notebook.
              </div>
              <p style={{ fontSize: 13.5, color: t.inkDim, lineHeight: 1.6, marginTop: 6 }}>
                {statusLine}. The inventory is what you saw in your first five minutes; the two steps
                below are optional ways to go deeper — or you can take the data straight.
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
            <Stat t={t} value={`${s.invited}/${s.invitedTotal}`} label="Inviting features" tone={c} />
            <Stat t={t} value={`${s.hindered}/${s.hinderedTotal}`} label="Hindering features" tone={s.hindered > 0 ? '#B3261E' : undefined} />
            <Stat t={t} value={s.patterns} label="Spatial patterns" />
            <Stat t={t} value={`${s.rated}/${s.ratedTotal}`} label="Reflection answered" />
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Btn t={t} variant="primary" size="lg" onClick={() => setStep('export')}>Finish & export data</Btn>
            <Btn t={t} variant="outline" size="md" icon="plus" onClick={() => setStep('spatial')}>Add spatial mapping (optional)</Btn>
            <Btn t={t} variant="outline" size="md" icon="plus" onClick={() => setStep('reflection')}>Add qualitative reflection (optional)</Btn>
          </div>

          <div>
            <Btn t={t} variant="ghost" size="sm" icon="pencil" onClick={() => setDone(false)}>Edit the site inventory again</Btn>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <Panel t={t} title="Step 1 · Site setup">
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: t.surfaceAlt,
              borderRadius: 12, padding: '10px 12px', marginBottom: 18 }}>
              <Icon name="sparkle" size={16} stroke={2} style={{ color: c, marginTop: 1, flex: '0 0 auto' }} />
              <p style={{ fontSize: 13, color: t.inkDim, lineHeight: 1.55 }}>
                Bring clothes for the weather and take at least 5 minutes to observe before filling out.
              </p>
            </div>

            <Field t={t} id="meta-site" label="Site name">
              <input id="meta-site" type="text" placeholder="e.g. Lindenplatz" value={survey.meta.siteName}
                onChange={(event) => setMeta('siteName', event.target.value)} style={siteInput} />
            </Field>

            <div style={{ marginTop: 14, marginBottom: 14 }}>
              <span className="placer-mono" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: t.inkDim }}>
                Space type
              </span>
              <div role="group" aria-label="Space type" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                {SPACE_TYPES.map((type) => (
                  <Chip key={type} t={t} color={c} active={survey.meta.spaceType === type}
                    ariaPressed={survey.meta.spaceType === type} onClick={() => setMeta('spaceType', type)}>
                    {type}
                  </Chip>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 140px', minWidth: 0 }}>
                <Field t={t} id="meta-date" label="Date">
                  <DatePicker t={t} id="meta-date" value={survey.meta.date} label="Choose the survey date"
                    onChange={(date) => setMeta('date', date)} style={siteInput} />
                </Field>
              </div>
              <div style={{ flex: '1 1 120px', minWidth: 0 }}>
                <Field t={t} id="meta-time" label="Time">
                  <input id="meta-time" type="time" value={survey.meta.time} placeholder="10:30"
                    onChange={(event) => setMeta('time', event.target.value)} style={siteInput} />
                </Field>
              </div>
              <div style={{ flex: '2 1 220px', minWidth: 0 }}>
                <Field t={t} id="meta-weather" label="Weather" hint="Tap a preset or describe it in your own words.">
                  <input id="meta-weather" type="text" value={survey.meta.weather} placeholder="Sunny, light breeze"
                    onChange={(event) => setMeta('weather', event.target.value)} style={siteInput} />
                </Field>
                <div role="group" aria-label="Weather presets" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                  {WEATHER_PRESETS.map((preset) => (
                    <Chip key={preset} t={t} color={c} active={survey.meta.weather === preset}
                      ariaPressed={survey.meta.weather === preset} onClick={() => setMeta('weather', preset)}>
                      {preset}
                    </Chip>
                  ))}
                </div>
              </div>
            </div>
          </Panel>

          <Panel t={t} title="Step 1 · Site inventory checklist" aside={
            <span className="placer-mono" style={{ fontSize: 11, color: t.inkFaint }}>tick what is present</span>
          }>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              <section style={{ flex: '1 1 420px', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <Icon name="sparkle" size={16} stroke={2.2} style={{ color: c }} />
                  <span style={{ fontSize: 14.5, fontWeight: 700, color: t.ink, letterSpacing: '-0.02em' }}>Inviting features</span>
                  <span className="placer-mono" style={{ fontSize: 11, color: t.inkDim }}>items 1–14 · {s.invited}/{s.invitedTotal}</span>
                </div>
                <p style={{ fontSize: 12.5, color: t.inkDim, lineHeight: 1.5, marginBottom: 6 }}>
                  Things that make a space welcoming. Tick each and add a note about what you found.
                </p>
                <ul style={{ listStyle: 'none' }}>
                  {INVITING_ITEMS.map((item) => {
                    const entry = survey.inventory.inviting[item.key];
                    const checked = Boolean(entry?.checked);
                    return (
                      <li key={item.key} style={{ borderBottom: `1px solid ${t.line}`, padding: '9px 0' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                          <span className="placer-mono" style={{ flex: '0 0 auto', width: 26, height: 26, borderRadius: 12,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700,
                            background: checked ? c + '18' : t.surfaceAlt, color: checked ? c : t.inkDim,
                            border: `1px solid ${checked ? c : t.line}` }}>{item.number}</span>
                          <label htmlFor={`inv-${item.key}`} style={{ flex: 1, display: 'flex', alignItems: 'center',
                            justifyContent: 'space-between', gap: 12, cursor: 'pointer' }}>
                            <span style={{ fontSize: 14, fontWeight: 500, color: t.ink, lineHeight: 1.4 }}>{item.label}</span>
                            <input id={`inv-${item.key}`} type="checkbox" checked={checked}
                              onChange={() => toggleInviting(item.key)} style={{ width: 17, height: 17, accentColor: c, flex: '0 0 auto' }} />
                          </label>
                        </div>
                        {checked && (
                          <textarea
                            aria-label={`${item.label} — what did you find?`}
                            value={entry?.detail || ''}
                            onChange={(event) => setInvitingDetail(item.key, event.target.value)}
                            placeholder={item.detail}
                            rows={2}
                            style={{ ...areaInput, marginTop: 10, marginLeft: 36, width: 'calc(100% - 36px)' }} />
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>

              <section style={{ flex: '1 1 360px', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <Icon name="close" size={16} stroke={2.2} style={{ color: '#B3261E' }} />
                  <span style={{ fontSize: 14.5, fontWeight: 700, color: t.ink, letterSpacing: '-0.02em' }}>Hindering features</span>
                  <span className="placer-mono" style={{ fontSize: 11, color: t.inkDim }}>items 15–18 · {s.hindered}/{s.hinderedTotal}</span>
                </div>
                <p style={{ fontSize: 12.5, color: t.inkDim, lineHeight: 1.5, marginBottom: 6 }}>
                  Barriers that stop a space being shared. A hindering feature does not cancel an inviting one —
                  it just changes the balance.
                </p>
                <ul style={{ listStyle: 'none' }}>
                  {HINDERING_ITEMS.map((item) => {
                    const checked = Boolean(survey.inventory.hindering[item.key]);
                    return (
                      <li key={item.key} style={{ borderBottom: `1px solid ${t.line}`, padding: '9px 0' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                          <span className="placer-mono" style={{ flex: '0 0 auto', width: 26, height: 26, borderRadius: 12,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700,
                            background: checked ? '#B3261E18' : t.surfaceAlt, color: checked ? '#B3261E' : t.inkDim,
                            border: `1px solid ${checked ? '#B3261E' : t.line}` }}>{item.number}</span>
                          <label htmlFor={`hin-${item.key}`} style={{ flex: 1, display: 'flex', alignItems: 'center',
                            justifyContent: 'space-between', gap: 12, cursor: 'pointer' }}>
                            <span style={{ fontSize: 14, fontWeight: 500, color: t.ink, lineHeight: 1.4 }}>{item.label}</span>
                            <input id={`hin-${item.key}`} type="checkbox" checked={checked}
                              onChange={() => toggleHindering(item.key)} style={{ width: 17, height: 17, accentColor: '#B3261E', flex: '0 0 auto' }} />
                          </label>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            </div>

            <div style={{ marginTop: 6 }}>
              <Btn t={t} variant="primary" size="lg" full onClick={() => setDone(true)}>Complete step 1</Btn>
            </div>
          </Panel>
        </div>
      ))}

      {step === 'spatial' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <Panel t={t} title="Step 2 · Architectural & spatial mapping" aside={
            <span tabIndex={0} role="note" aria-label="What Parti mapping is" title="Parti mapping (from the French 'parti pris', 'taking a side') diagrams the forces shaping a space — where people are drawn to, where they are pushed together, and where they can watch from the edge. It is the sketch behind a design argument.">
              <Icon name="comment" size={16} stroke={2} style={{ color: t.inkDim, cursor: 'help' }} />
            </span>
          }>
            <p style={{ fontSize: 13.5, color: t.inkDim, lineHeight: 1.6 }}>
              Parti mapping is the drawing that says where the social life of a space actually comes from.
              Log the three patterns below as you see them — a feature per entry, each rated 1–5. All three are optional.
            </p>
          </Panel>

          {PATTERN_KINDS.map((kind) => {
            const entries = survey.spatialPatterns?.[kind.key] || [];
            return (
              <Panel key={kind.key} title={`${kind.title} (${kind.subtitle})`} t={t} aside={
                <span className="placer-mono" style={{ fontSize: 11, color: t.inkFaint }}>{entries.length} logged</span>
              }>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 14 }}>
                  <Icon name={kind.icon} size={18} stroke={2.1} style={{ color: c, flex: '0 0 auto', marginTop: 2 }} />
                  <p style={{ fontSize: 13, color: t.inkDim, lineHeight: 1.55 }}>{kind.help}</p>
                </div>

                {entries.length === 0 ? (
                  <p style={{ fontSize: 13.5, color: t.inkDim, lineHeight: 1.6, marginBottom: 14, fontStyle: 'italic' }}>
                    {kind.empty}
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 14 }}>
                    {entries.map((entry, index) => (
                      <div key={index} style={{ border: `1px solid ${t.line}`, borderRadius: 12, padding: 14, background: t.surfaceAlt }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                          <span className="placer-mono" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
                            textTransform: 'uppercase', color: t.inkDim }}>{kind.title} {index + 1}</span>
                          <div style={{ flex: 1 }} />
                          <Btn t={t} variant="ghost" size="sm" ariaLabel={`Remove ${kind.title} entry ${index + 1}`}
                            onClick={() => removePattern(kind.key, index)}>
                            <Icon name="trash" size={15} stroke={2} style={{ color: t.inkDim }} />
                          </Btn>
                        </div>

                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                          <div style={{ flex: '2 1 260px', minWidth: 0 }}>
                            <Field t={t} id={`${kind.key}-${index}-feature`} label={kind.featureLabel} hint={kind.featurePlaceholder}>
                              <input id={`${kind.key}-${index}-feature`} type="text" value={entry.feature}
                                onChange={(event) => setPattern(kind.key, index, 'feature', event.target.value)}
                                placeholder={kind.featurePlaceholder} style={siteInput} />
                            </Field>
                          </div>
                          <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                            <span className="placer-mono" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
                              textTransform: 'uppercase', color: t.inkDim }}>{kind.strengthTitle}</span>
                            <div role="group" aria-label={`${kind.title} ${index + 1} strength`} style={{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'center' }}>
                              {[1, 2, 3, 4, 5].map((n) => (
                                <button key={n} type="button" aria-pressed={entry.strength === n}
                                  aria-label={`Strength ${n} of 5`} onClick={() => setPattern(kind.key, index, 'strength', n)}
                                  style={{ width: 32, height: 32, borderRadius: 12, cursor: 'pointer',
                                    fontFamily: 'var(--placer-font)', fontWeight: 700, fontSize: 13.5,
                                    background: n <= entry.strength ? c + '2E' : 'transparent',
                                    border: `1.5px solid ${n <= entry.strength ? c : t.line}`,
                                    color: n <= entry.strength ? c : t.inkDim }}>
                                  {n}
                                </button>
                              ))}
                              <span className="placer-mono" style={{ fontSize: 12, fontWeight: 700, color: t.ink, marginLeft: 6 }}>
                                {entry.strength}/5
                              </span>
                            </div>
                          </div>
                        </div>

                        <div style={{ marginTop: 10 }}>
                          <Field t={t} id={`${kind.key}-${index}-notes`} label="Notes">
                              <textarea id={`${kind.key}-${index}-notes`} rows={2} value={entry.note}
                                onChange={(event) => setPattern(kind.key, index, 'note', event.target.value)}
                                placeholder="Anything worth remembering — who it pulls, when it works…" style={areaInput} />
                            </Field>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <Btn t={t} variant="quiet" size="sm" icon="plus" onClick={() => addPattern(kind.key)}>{kind.addLabel}</Btn>
              </Panel>
            );
          })}

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <Btn t={t} variant="outline" size="md" onClick={() => setStep('export')}>Finish & export data</Btn>
            <Btn t={t} variant="primary" size="md" icon="chevRight" onClick={() => setStep('reflection')}>Next — reflection</Btn>
          </div>
        </div>
      )}

      {step === 'reflection' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <Panel t={t} title="Step 3 · Social cohesion & inclusion assessment">
            <p style={{ fontSize: 13.5, color: t.inkDim, lineHeight: 1.6, marginBottom: 6 }}>
              Four judgements, each on a simple scale. Nothing here is technical — it is what the place
              felt like for the people in it.
            </p>
            {RATING_QUESTIONS.map((question) => {
              const value = survey.qualitativeReflection?.ratings?.[question.key];
              return (
                <div key={question.key} style={{ borderBottom: `1px solid ${t.line}`, padding: '14px 0' }}>
                  <div style={{ fontSize: 14.5, fontWeight: 700, color: t.ink, lineHeight: 1.45, marginBottom: 10 }}>
                    {question.label}
                  </div>
                  <div role="group" aria-label={question.label} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {RATING_OPTIONS.map((option) => (
                      <Chip key={option.value} t={t} color={c} active={value === option.value}
                        ariaPressed={value === option.value} onClick={() => setRating(question.key, option.value)}>
                        {option.label}
                      </Chip>
                    ))}
                  </div>
                </div>
              );
            })}
          </Panel>

          <Panel t={t} title="Qualitative notes" aside={
            <span className="placer-mono" style={{ fontSize: 11, color: t.inkFaint }}>{s.notes}/3</span>
          }>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {REFLECTION_NOTE_FIELDS.map((field) => (
                <Field key={field.key} t={t} id={`note-${field.key}`} label={field.label} hint={field.placeholder}>
                  <textarea id={`note-${field.key}`} rows={3} value={survey.qualitativeReflection?.notes?.[field.key] || ''}
                    onChange={(event) => setNote(field.key, event.target.value)} placeholder={field.placeholder} style={areaInput} />
                </Field>
              ))}
            </div>
          </Panel>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <Btn t={t} variant="outline" size="md" onClick={() => setStep('export')}>Finish & export data</Btn>
            <Btn t={t} variant="primary" size="md" icon="check" onClick={() => setStep('export')}>Keep & export</Btn>
          </div>
        </div>
      )}

      {step === 'export' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <Panel t={t} title="Review & export" aside={
            <span className="placer-mono" style={{ fontSize: 11, color: t.inkFaint }}>{s.invited}+{s.hindered}+{s.patterns}+{s.rated}</span>
          }>
            <p style={{ fontSize: 13.5, color: t.inkDim, lineHeight: 1.6, marginBottom: 16 }}>
              Your survey, compiled below. PLACER saves nothing, so the download is the moment the data
              becomes yours. The JSON keeps the full structure — including the optional
              <span className="placer-mono" style={{ fontSize: 12, color: t.ink }}> spatialPatterns </span>
              and
              <span className="placer-mono" style={{ fontSize: 12, color: t.ink }}> qualitativeReflection </span>
              keys only when you recorded them.
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Btn t={t} variant="primary" size="md" onClick={downloadJSON}>Download JSON</Btn>
              <Btn t={t} variant="primary" size="md" onClick={downloadSummaryFile}>Download summary (.txt)</Btn>
              <CopyButton t={t} variant="quiet" size="md" icon="send" label="Copy summary" copiedLabel="Summary copied"
                value={summary} fieldLabel="Your survey summary" multiline />
            </div>
          </Panel>

          <Panel t={t} title="Compiled survey" aside={
            <span className="placer-mono" style={{ fontSize: 11, color: t.inkFaint }}>what your data says</span>
          }>
            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0,
              fontFamily: "'Space Mono', monospace", fontSize: 12, color: t.inkDim, lineHeight: 1.65 }}>
              {summary}
            </pre>
          </Panel>

          <div>
            <Btn t={t} variant="ghost" size="sm" icon="trash" onClick={() => {
              if (window.confirm('Start a fresh survey? Everything on this page will be cleared.')) reset();
            }}>
              Start over
            </Btn>
          </div>
        </div>
      )}
    </div>
  );
}

export default SocialSpaceSurvey;