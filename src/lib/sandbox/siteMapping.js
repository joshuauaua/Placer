// PLACER — Sandbox: Site-Specific Spatial Mapping Tool, pure logic.
//
// The component (src/components/sandbox/SiteMapping.jsx) renders; this module
// only describes: the site presets, the 18 ordered survey questions, the five
// draggable map markers, the reflection prompts, and the pure helpers that fold
// answers + markers + notes into a portable summary.

export const SITE_PRESETS = [
  {
    key: 'lindenplatz',
    label: 'Lindenplatz',
    lat: 52.5206,
    lng: 13.4095,
    note: 'Neighbourhood square with a lawn, kiosks and a tram stop at the corner.',
  },
  {
    key: 'riverside',
    label: 'Riverside Steps',
    lat: 52.4986,
    lng: 13.4253,
    note: 'Sloped embankment with steps down to the water and a cycling path behind.',
  },
  {
    key: 'market',
    label: 'Market Square',
    lat: 52.5134,
    lng: 13.3912,
    note: 'Paved plaza with stalls on market days and ground-floor shops around it.',
  },
];

// The 18 questions of Section 1, in the order the card stack asks them.
// Items 1-14 are inviting features, 15-18 hindering — the same split as the
// Gehl-derived Social Space Survey, restated here so the card flow owns its copy.
export const SURVEY_QUESTIONS = [
  { number: 1, key: 'seating', kind: 'inviting', label: 'A variety of seating and resting places', detail: 'Benches, ledges, steps, moveable chairs?' },
  { number: 2, key: 'views', kind: 'inviting', label: 'Nice views, or things to look at', detail: 'Water, skyline, trees, other people?' },
  { number: 3, key: 'slopes', kind: 'inviting', label: 'Sloped areas or steps suitable for sitting', detail: 'Ground, walls or steps people actually sit on?' },
  { number: 4, key: 'gateways', kind: 'inviting', label: 'Gateways or well-defined entrances', detail: 'Does the space announce itself at its edges?' },
  { number: 5, key: 'exercise', kind: 'inviting', label: 'Areas for exercise', detail: 'Bars, loops, informal courts?' },
  { number: 6, key: 'playground', kind: 'inviting', label: 'A playground or kid-friendly space', detail: 'What does it offer different ages?' },
  { number: 7, key: 'lawn', kind: 'inviting', label: 'A multipurpose lawn', detail: 'Picnics, frisbee, lying down — really open?' },
  { number: 8, key: 'plaza', kind: 'inviting', label: 'A multipurpose plaza', detail: 'Markets, events — what has happened here?' },
  { number: 9, key: 'vendors', kind: 'inviting', label: 'Fixed food or drink vendors, or carts', detail: 'Where do they gather?' },
  { number: 10, key: 'storefronts', kind: 'inviting', label: 'A variety of active ground-floor businesses', detail: 'What can you do or buy at street level?' },
  { number: 11, key: 'tables', kind: 'inviting', label: 'Tables for eating and socializing', detail: 'Who uses them — are they shared?' },
  { number: 12, key: 'teamSports', kind: 'inviting', label: 'Areas for team sports', detail: 'Courts, pitches, or space that becomes one?' },
  { number: 13, key: 'restrooms', kind: 'inviting', label: 'Public restrooms', detail: 'Open, signed, accessible?' },
  { number: 14, key: 'lighting', kind: 'inviting', label: 'Good lighting at night', detail: 'Warm, at head height, where people stay?' },
  { number: 15, key: 'fences', kind: 'hindering', label: 'Unnecessary permanent fences or barriers', detail: '' },
  { number: 16, key: 'offLimits', kind: 'hindering', label: 'Off-limits areas', detail: '' },
  { number: 17, key: 'grade', kind: 'hindering', label: 'Extreme grade changes, uneven paving, or other mobility barriers', detail: '' },
  { number: 18, key: 'exclusion', kind: 'hindering', label: 'Only expensive food or shopping, accessible to high-income users', detail: '' },
];

// The five draggable icons of Section 2. `icon` names the Icon component entry,
// `color` the marker fill, `verb` the status-line wording.
export const MAP_MARKERS = [
  { key: 'magnet', label: 'Magnet', icon: 'sparkle', color: '#3A2480', verb: 'something that pulls people in', help: 'Art, vendors, a view — what draws a crowd?' },
  { key: 'gathering', label: 'Gathering', icon: 'user', color: '#1D5FA8', verb: 'where strangers end up together', help: 'A crossing, a queue, a narrow passage?' },
  { key: 'refuge', label: 'Edge & refuge', icon: 'bench', color: '#123F73', verb: 'where you can join without committing', help: 'A long bench, a wall, a slope to watch from?' },
  { key: 'barrier', label: 'Barrier', icon: 'close', color: '#B3261E', verb: 'something that blocks or pushes away', help: 'A fence, a blank wall, a hostile grade?' },
  { key: 'favourite', label: 'Favourite spot', icon: 'heart', color: '#9E4600', verb: 'somewhere you would return to', help: 'Your own anchor in the space.' },
];

export const REFLECTION_PROMPTS = [
  { key: 'belonging', label: 'Who belongs here?', placeholder: 'Who was here — and who was missing? Age, company, mood…' },
  { key: 'moment', label: 'One moment that stayed with you', placeholder: 'A small scene: two strangers, a kid, a pause…' },
  { key: 'change', label: 'One change you would make', placeholder: 'If you could move, add or remove one thing…' },
];

export const REFLECTION_MOODS = [
  { value: 0, label: 'Uneasy' },
  { value: 1, label: 'Neutral' },
  { value: 2, label: 'Welcome' },
  { value: 3, label: 'At home' },
];

// Who is answering? Asked once on the site-picker step, kept with the export.
// Both are optional — "Prefer not to say" is a real answer, not a skip.
export const AGE_RANGES = [
  { value: 'under-18', label: 'Under 18' },
  { value: '18-24', label: '18–24' },
  { value: '25-34', label: '25–34' },
  { value: '35-44', label: '35–44' },
  { value: '45-54', label: '45–54' },
  { value: '55-64', label: '55–64' },
  { value: '65-plus', label: '65+' },
  { value: 'prefer-not-to-say', label: 'Prefer not to say' },
];

export const GENDER_OPTIONS = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'non-binary', label: 'Non-binary' },
  { value: 'self-describe', label: 'Self-describe' },
  { value: 'prefer-not-to-say', label: 'Prefer not to say' },
];

const MOOD_LABEL = Object.fromEntries(REFLECTION_MOODS.map((m) => [m.value, m.label]));
const AGE_LABEL = Object.fromEntries(AGE_RANGES.map((m) => [m.value, m.label]));
const GENDER_LABEL = Object.fromEntries(GENDER_OPTIONS.map((m) => [m.value, m.label]));

/** Blank respondent profile (age / gender) — both optional. */
export function emptyProfile() {
  return { ageRange: '', gender: '', genderSelf: '' };
}

/** Blank follow-up contact — everything optional, consent defaults off. */
export function emptyContact() {
  return { name: '', email: '', phone: '', consent: false };
}

/** Very small email check — just enough to catch a missing @ before export. */
export function isValidEmail(email) {
  if (!email || !String(email).trim()) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
}

/** Blank answers: every question key maps to null (unanswered). */
export function emptyAnswers() {
  return Object.fromEntries(SURVEY_QUESTIONS.map((q) => [q.key, null]));
}

export function emptyState() {
  return {
    answers: emptyAnswers(),
    markers: [],
    mood: null,
    notes: {},
    profile: emptyProfile(),
    contact: emptyContact(),
  };
}

/** Answer one question; value is true (yes / present) or false (no / absent). */
export function answerQuestion(answers, key, value) {
  return { ...answers, [key]: value };
}

export function answeredCount(answers) {
  return SURVEY_QUESTIONS.filter((q) => answers?.[q.key] === true || answers?.[q.key] === false).length;
}

export function isSurveyComplete(answers) {
  return answeredCount(answers) === SURVEY_QUESTIONS.length;
}

/** First unanswered question key, or null when the stack is done. */
export function nextUnanswered(answers) {
  const found = SURVEY_QUESTIONS.find((q) => answers?.[q.key] !== true && answers?.[q.key] !== false);
  return found ? found.key : null;
}

export function invitingCount(answers) {
  return SURVEY_QUESTIONS.filter((q) => q.kind === 'inviting' && answers?.[q.key] === true).length;
}

export function hinderingCount(answers) {
  return SURVEY_QUESTIONS.filter((q) => q.kind === 'hindering' && answers?.[q.key] === true).length;
}

let markerSeq = 0;

/** Place a marker of `type` at normalised map coords (0-1 in both axes). */
export function placeMarker(markers, type, x, y) {
  const kind = MAP_MARKERS.find((m) => m.key === type);
  if (!kind) return markers;
  markerSeq += 1;
  return [...markers, { id: `marker-${markerSeq}`, type, x: clamp01(x), y: clamp01(y) }];
}

export function removeMarker(markers, id) {
  return markers.filter((m) => m.id !== id);
}

export function markerCounts(markers) {
  return Object.fromEntries(MAP_MARKERS.map((kind) => [kind.key, markers.filter((m) => m.type === kind.key).length]));
}

function clamp01(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0.5;
  return Math.min(0.98, Math.max(0.02, n));
}

/** Parse a "lat, lng" site search into coordinates, or null when unparseable. */
export function parseSiteSearch(text) {
  if (!text) return null;
  const match = String(text).split(',').map((part) => Number(part.trim()));
  if (match.length !== 2 || !match.every(Number.isFinite)) return null;
  const [lat, lng] = match;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

export function googleMapsUrl(site) {
  if (!site || !Number.isFinite(site.lat) || !Number.isFinite(site.lng)) return null;
  return `https://www.google.com/maps/search/?api=1&query=${site.lat},${site.lng}`;
}

export function hasReflection(state) {
  if (state?.mood !== null && state?.mood !== undefined) return true;
  return REFLECTION_PROMPTS.some((field) => {
    const value = state?.notes?.[field.key];
    return value && String(value).trim();
  });
}

export function buildJSON(site, state) {
  return JSON.stringify(
    {
      site: { name: site?.name || '(unnamed)', lat: site?.lat ?? null, lng: site?.lng ?? null },
      respondent: {
        ageRange: state.profile?.ageRange || null,
        gender: state.profile?.gender || null,
        genderSelf: state.profile?.gender === 'self-describe' ? state.profile?.genderSelf || '' : undefined,
      },
      inventory: Object.fromEntries(
        SURVEY_QUESTIONS.map((q) => [q.key, state.answers?.[q.key] === true]),
      ),
      spatialMarkers: (state.markers || []).map((m) => ({ type: m.type, x: m.x, y: m.y })),
      reflection: {
        mood: state.mood,
        notes: Object.fromEntries(REFLECTION_PROMPTS.map((f) => [f.key, state.notes?.[f.key] || ''])),
      },
      contact: {
        name: state.contact?.name || '',
        email: state.contact?.email || '',
        phone: state.contact?.phone || '',
        consent: state.contact?.consent === true,
      },
    },
    null,
    2,
  );
}

export function buildSummary(site, state) {
  const invited = invitingCount(state.answers);
  const hindered = hinderingCount(state.answers);
  const counts = markerCounts(state.markers || []);
  const lines = [
    'SITE-SPECIFIC SPATIAL MAPPING — PLACER Sandbox',
    '',
    'SITE',
    `Name: ${site?.name || '(unnamed)'}`,
    site && Number.isFinite(site.lat) ? `Location: ${site.lat}, ${site.lng}` : 'Location: —',
    '',
    `SITE SURVEY — ${answeredCount(state.answers)}/18 answered`,
    `Inviting features present: ${invited} of 14`,
  ];
  for (const q of SURVEY_QUESTIONS.filter((item) => item.kind === 'inviting')) {
    lines.push(`  ${state.answers?.[q.key] === true ? '[x]' : '[ ]'} ${q.number}. ${q.label}`);
  }
  lines.push(`Hindering features present: ${hindered} of 4`);
  for (const q of SURVEY_QUESTIONS.filter((item) => item.kind === 'hindering')) {
    lines.push(`  ${state.answers?.[q.key] === true ? '[x]' : '[ ]'} ${q.number}. ${q.label}`);
  }
  const age = state.profile?.ageRange ? AGE_LABEL[state.profile.ageRange] || state.profile.ageRange : '—';
  const genderRaw = state.profile?.gender ? GENDER_LABEL[state.profile.gender] || state.profile.gender : '—';
  const gender =
    state.profile?.gender === 'self-describe' && state.profile?.genderSelf?.trim()
      ? `Self-describe (${state.profile.genderSelf.trim()})`
      : genderRaw;
  lines.push('', `ABOUT YOU — age: ${age} · gender: ${gender}`);
  lines.push('', 'SPATIAL MARKERS');
  let placed = 0;
  for (const kind of MAP_MARKERS) {
    const n = counts[kind.key] || 0;
    placed += n;
    lines.push(`  ${kind.label}: ${n}`);
  }
  if (placed === 0) lines.push('  none placed');
  if (hasReflection(state)) {
    lines.push('', 'REFLECTION');
    lines.push(`  Feeling: ${state.mood === null || state.mood === undefined ? '—' : MOOD_LABEL[state.mood]}`);
    for (const field of REFLECTION_PROMPTS) {
      const value = state.notes?.[field.key];
      lines.push(`  ${field.label}: ${value && String(value).trim() ? `\n${value}` : ' (none)'}`);
    }
  }
  const contact = state.contact || {};
  if (contact.name?.trim() || contact.email?.trim() || contact.phone?.trim() || contact.consent) {
    lines.push('', 'FOLLOW-UP CONTACT');
    lines.push(`  Name: ${contact.name?.trim() || '(none)'}`);
    lines.push(`  Email: ${contact.email?.trim() || '(none)'}`);
    lines.push(`  Phone: ${contact.phone?.trim() || '(none)'}`);
    lines.push(`  Happy to be contacted: ${contact.consent ? 'yes' : 'no'}`);
  }
  lines.push('', 'Recorded in the PLACER Sandbox — nothing is saved unless you download or share it.');
  return lines.join('\n');
}
