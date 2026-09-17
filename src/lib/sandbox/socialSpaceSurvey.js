export const SPACE_TYPES = ['Park', 'Plaza', 'Street'];

export const WEATHER_PRESETS = ['Sunny', 'Overcast', 'Drizzle', 'Cold', 'Windy'];

export const INVITING_ITEMS = [
  { number: 1, key: 'seating', label: 'A variety of seating and resting places', detail: 'Where are people sitting — benches, ledges, steps, moveable chairs?' },
  { number: 2, key: 'views', label: 'Nice views, or things to look at', detail: 'What draws the eye — water, skyline, trees, other people?' },
  { number: 3, key: 'slopes', label: 'Sloped areas or steps suitable for sitting', detail: 'Where can someone sit on the ground or on a wall?' },
  { number: 4, key: 'gateways', label: 'Gateways or well-defined entrances', detail: 'How does the space announce itself at its edges?' },
  { number: 5, key: 'exercise', label: 'Areas for exercise', detail: 'Calisthenics bars, running loops, informal courts?' },
  { number: 6, key: 'playground', label: 'A playground or kid-friendly space', detail: 'What does it offer different ages?' },
  { number: 7, key: 'lawn', label: 'A multipurpose lawn', detail: 'Picnics, frisbee, lying down — is it really open?' },
  { number: 8, key: 'plaza', label: 'A multipurpose plaza', detail: 'Markets, demonstrations, events — what has happened here?' },
  { number: 9, key: 'vendors', label: 'Fixed food or drink vendors, or carts', detail: 'Where do they gather, and how do people use them?' },
  { number: 10, key: 'storefronts', label: 'A variety of active ground-floor businesses', detail: 'What can you do or buy at street level?' },
  { number: 11, key: 'tables', label: 'Tables for eating and socializing', detail: 'Who is using them, and are they shared?' },
  { number: 12, key: 'teamSports', label: 'Areas for team sports', detail: 'Courts, pitches, or space that becomes one on the day?' },
  { number: 13, key: 'restrooms', label: 'Public restrooms', detail: 'Where are they, and are they open and accessible?' },
  { number: 14, key: 'lighting', label: 'Good lighting at night', detail: 'Warm, at head height, around places people stay?' },
];

export const HINDERING_ITEMS = [
  { number: 15, key: 'fences', label: 'Unnecessary permanent fences or barriers' },
  { number: 16, key: 'offLimits', label: 'Off-limits areas' },
  { number: 17, key: 'grade', label: 'Extreme grade changes, uneven paving, or other mobility barriers' },
  { number: 18, key: 'exclusion', label: 'Only expensive food or shopping, accessible to high-income users' },
];

export const RATING_OPTIONS = [
  { value: 0, label: 'Not at all' },
  { value: 1, label: 'Maybe' },
  { value: 2, label: 'Yes' },
  { value: 3, label: 'Totally' },
];

export const RATING_LABEL = Object.fromEntries(RATING_OPTIONS.map((option) => [option.value, option.label]));

export const RATING_QUESTIONS = [
  { key: 'peopleWatching', label: 'Is this place good for people-watching, or coexisting side by side with strangers?' },
  { key: 'friendsFamily', label: 'Is this place good for being social with friends or family?' },
  { key: 'variedActivities', label: 'Is this place good for doing different types of activities?' },
  { key: 'diverseInvitation', label: 'Is this place good for inviting people of different backgrounds and interests?' },
];

export const REFLECTION_NOTE_FIELDS = [
  { key: 'demographics', label: 'Demographics you noticed', placeholder: 'Age, gender, perceived income, physical ability — who was here, and who was not?' },
  { key: 'design', label: 'Design or program elements', placeholder: 'What helped or hindered interaction, and how?' },
  { key: 'observedVsExpected', label: 'Observed vs expected', placeholder: 'How did the social life compare with what you expected here?' },
];

export const PATTERN_KINDS = [
  {
    key: 'magnets',
    title: 'Magnets',
    subtitle: 'Attractions',
    icon: 'pin',
    addLabel: 'Add a magnet',
    empty: 'Nothing logged yet. What is pulling people in?',
    featureLabel: 'What draws people in?',
    featurePlaceholder: 'A stage, a sculpture, the food carts, a view…',
    strengthTitle: 'How strongly does it pull?',
    help: 'Log the features that draw people into the space — art, events, vendors, something worth stopping for — and rate how strongly they pull.',
  },
  {
    key: 'compression',
    title: 'Compression',
    subtitle: 'Proximity drivers',
    icon: 'move',
    addLabel: 'Add a proximity driver',
    empty: 'Nothing logged yet. Where do strangers end up close together?',
    featureLabel: 'What brings strangers together?',
    featurePlaceholder: 'A narrow alley, a gateway, a crossing that funnels people…',
    strengthTitle: 'How much contact does it create?',
    help: 'Log the features that bring strangers close together naturally — gateways, paths, narrow alleys — and rate how much contact they create.',
  },
  {
    key: 'participation',
    title: 'Range of participation',
    subtitle: 'Edges & refuge',
    icon: 'layers',
    addLabel: 'Add an edge / refuge spot',
    empty: 'Nothing logged yet. Where can people join without committing?',
    featureLabel: 'Where can people join at their own pace?',
    featurePlaceholder: 'A long bench, a seatwall, a slope, a prospect-and-refuge spot…',
    strengthTitle: 'How easily can people drop in and out?',
    help: 'Log the elements that let people engage at their own pace — seatwalls, benches, slopes, edges, spots to watch from — and rate how easy they make it.',
  },
];

export function emptySurvey() {
  return {
    meta: { siteName: '', spaceType: 'Park', date: '', time: '', weather: '' },
    inventory: { inviting: {}, hindering: {} },
    spatialPatterns: null,
    qualitativeReflection: null,
  };
}

export function stats(survey) {
  const invited = INVITING_ITEMS.filter((item) => survey.inventory?.inviting?.[item.key]?.checked).length;
  const hindered = HINDERING_ITEMS.filter((item) => survey.inventory?.hindering?.[item.key]).length;
  const patterns = survey.spatialPatterns
    ? PATTERN_KINDS.reduce((count, kind) => count + (survey.spatialPatterns[kind.key]?.length || 0), 0)
    : 0;
  const ratings = survey.qualitativeReflection?.ratings || {};
  const rated = RATING_QUESTIONS.filter(
    (question) => ratings[question.key] !== undefined && ratings[question.key] !== null
  ).length;
  const notes = survey.qualitativeReflection?.notes || {};
  const noteCount = REFLECTION_NOTE_FIELDS.filter((field) => {
    const value = notes[field.key];
    return value && String(value).trim();
  }).length;
  return {
    invited,
    invitedTotal: INVITING_ITEMS.length,
    hindered,
    hinderedTotal: HINDERING_ITEMS.length,
    patterns,
    rated,
    ratedTotal: RATING_QUESTIONS.length,
    notes: noteCount,
    hasSpatial: patterns > 0,
    hasReflection: rated > 0 || noteCount > 0,
  };
}

export function buildJSON(survey) {
  const base = emptySurvey();
  const meta = { ...base.meta, ...survey.meta };
  const inviting = Object.fromEntries(
    INVITING_ITEMS.map((item) => {
      const entry = survey.inventory?.inviting?.[item.key] || {};
      return [item.key, { checked: Boolean(entry.checked), detail: entry.detail || '' }];
    })
  );
  const hindering = Object.fromEntries(
    HINDERING_ITEMS.map((item) => [item.key, Boolean(survey.inventory?.hindering?.[item.key])])
  );
  const output = { meta, inventory: { inviting, hindering } };

  const patterns = survey.spatialPatterns
    ? Object.fromEntries(
        PATTERN_KINDS.map((kind) => [
          kind.key,
          (survey.spatialPatterns[kind.key] || []).map((entry) => ({
            feature: entry.feature || '',
            strength: entry.strength || 0,
            note: entry.note || '',
          })),
        ])
      )
    : null;
  if (patterns && PATTERN_KINDS.some((kind) => (patterns[kind.key] || []).length > 0)) {
    output.spatialPatterns = patterns;
  }

  const ratings = survey.qualitativeReflection?.ratings || {};
  const notes = survey.qualitativeReflection?.notes || {};
  const hasRatings = RATING_QUESTIONS.some(
    (question) => ratings[question.key] !== undefined && ratings[question.key] !== null
  );
  const hasNotes = REFLECTION_NOTE_FIELDS.some((field) => {
    const value = notes[field.key];
    return value && String(value).trim();
  });
  if (hasRatings || hasNotes) {
    output.qualitativeReflection = {};
    if (hasRatings) {
      output.qualitativeReflection.ratings = Object.fromEntries(
        RATING_QUESTIONS.map((question) => [question.key, ratings[question.key]])
      );
    }
    if (hasNotes) {
      output.qualitativeReflection.notes = Object.fromEntries(
        REFLECTION_NOTE_FIELDS.map((field) => [field.key, notes[field.key] || ''])
      );
    }
  }

  return JSON.stringify(output, null, 2);
}

export function buildSummary(survey) {
  const meta = survey.meta || {};
  const s = stats(survey);
  const lines = [
    'SOCIAL SPACE SURVEY — PLACER Sandbox',
    'A field tool drawn from the Gehl Institute Social Space Survey.',
    '',
    'SITE',
    `Name: ${meta.siteName || '(unnamed)'}`,
    `Space type: ${meta.spaceType || '—'}`,
    `Observed: ${[meta.date, meta.time].filter(Boolean).join(' at ') || '—'}`,
    `Weather: ${meta.weather || '—'}`,
    '',
    'SITE INVENTORY',
    `Inviting features present: ${s.invited} of ${s.invitedTotal}`,
  ];

  for (const item of INVITING_ITEMS) {
    const entry = survey.inventory?.inviting?.[item.key];
    const on = Boolean(entry?.checked);
    const suffix = on && entry.detail ? ` — ${entry.detail}` : '';
    lines.push(`${on ? '  [x]' : '  [ ]'} ${item.number}. ${item.label}${suffix}`);
  }

  lines.push(`Hindering features present: ${s.hindered} of ${s.hinderedTotal}`);
  for (const item of HINDERING_ITEMS) {
    const on = Boolean(survey.inventory?.hindering?.[item.key]);
    lines.push(`${on ? '  [x]' : '  [ ]'} ${item.number}. ${item.label}`);
  }

  if (s.hasSpatial) {
    lines.push('', 'SPATIAL PATTERNS');
    for (const kind of PATTERN_KINDS) {
      const entries = survey.spatialPatterns?.[kind.key] || [];
      lines.push(`${kind.title} (${kind.subtitle})`);
      if (entries.length === 0) {
        lines.push('  none logged');
      } else {
        for (const entry of entries) {
          const note = entry.note ? ` — ${entry.note}` : '';
          lines.push(`  - ${entry.feature || '(unnamed feature)'} — ${entry.strength || 0}/5${note}`);
        }
      }
    }
  }

  if (s.hasReflection) {
    lines.push('', 'SOCIAL COHESION & INCLUSION');
    for (const question of RATING_QUESTIONS) {
      const value = survey.qualitativeReflection?.ratings?.[question.key];
      const answer = value === undefined || value === null ? 'Not rated' : RATING_LABEL[value];
      lines.push(`  ${answer} — ${question.label}`);
    }
    const notes = survey.qualitativeReflection?.notes || {};
    for (const field of REFLECTION_NOTE_FIELDS) {
      const value = notes[field.key];
      const body = value && String(value).trim() ? `\n${value}` : ' (none)';
      lines.push(`  ${field.label}:${body}`);
    }
  }

  lines.push('', 'Recorded in the PLACER Sandbox — nothing is saved unless you download or share it.');
  return lines.join('\n');
}