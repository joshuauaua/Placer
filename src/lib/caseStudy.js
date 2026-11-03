/* PLACER — the "Add a case study" form, as data: its fields, the code that opens it,
 * what makes a submission complete, and the row it is saved as.
 *
 * The form is for the people we invite to write one up, not for everybody yet, so it
 * opens with a code. Only the code's SHA-256 is kept here, so it is not in the bundle
 * as plain text. That keeps it out of casual reach, not out of determined reach: the
 * real boundary is that survey_responses only ever takes inserts (supabase/schema.sql),
 * and nothing is published without the team reading it first.
 *
 * A submission is saved like every other form on this site, through saveSurveyResponse
 * into survey_responses, under its own `source`. Its pictures go in with it, shrunk on
 * the device to data URLs (lib/pictureEncode.js), since this site has no file storage.
 */

export const CASE_STUDY_SOURCE = 'case_study_submission';

// SHA-256 of the code, upper-cased, as codeMatches() compares it.
const CODE_SHA256 = '7c4b4cc0d854b5120c5ad2fb1885fa652be3e5c29070356275658ecc7dc01b9d';

// Remembered for the visit, so a reload does not ask for the code again.
export const UNLOCK_KEY = 'placer.caseStudy.unlocked';

export const MAX_TITLE = 120;
export const MAX_SUBTITLE = 200;
export const MAX_SHORT = 200;
export const MAX_STORY = 3000;
export const MAX_OTHER_IMAGES = 6;
export const MAX_ROWS = 12;

export const FUNDING_OPTIONS = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'undisclosed', label: 'Prefer not to say' },
];

export const emptyOrganisation = () => ({ name: '', role: '', email: '' });
export const emptyMember = () => ({ name: '', role: '', email: '' });
export const emptyLink = () => ({ label: '', url: '' });

export const EMPTY_CASE_STUDY = {
  title: '',
  subtitle: '',
  place: '',
  startDate: '',
  endDate: '',
  ongoing: false,
  need: '',
  approach: '',
  audience: '',
  outcome: '',
  funded: '',
  funder: '',
  amount: '',
  organisationName: '',
  organisationAccount: false,
  organisations: [],
  members: [],
  links: [],
  contactName: '',
  contactEmail: '',
  contactRole: '',
  consent: false,
};

async function sha256(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Whether `code` hashes to `hash`, as codeMatches compares: spaces and case do not matter. */
export async function codeHashMatches(code, hash) {
  const typed = String(code ?? '').trim().toUpperCase();
  if (!typed) return false;
  return (await sha256(typed)) === hash;
}

/**
 * Whether `code` is the one that opens the form. The code itself is never written out
 * in this repository, tests included, as the repository is public.
 */
export const codeMatches = (code) => codeHashMatches(code, CODE_SHA256);

export const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value ?? '').trim());

export function isValidUrl(value) {
  try {
    const url = new URL(String(value ?? '').trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

const text = (value) => String(value ?? '').trim();
const filled = (row) => Object.values(row).some((value) => text(value));

/**
 * What still needs doing, as { field: sentence }, or null when it can be sent. The keys
 * are the form's field names, so each sentence can sit under its field; a row of a list
 * is `members.2.email` and the like.
 */
export function validateCaseStudy(fields, { hero } = {}) {
  const problems = {};
  const need = (key, message) => { if (!text(fields[key])) problems[key] = message; };

  need('title', 'Give the case study a title.');
  need('subtitle', 'Sum it up in a sentence.');
  need('place', 'Say where it took place.');
  if (!hero) problems.hero = 'Add a header picture.';
  need('startDate', 'Say when it started.');
  if (!fields.ongoing && fields.endDate && fields.startDate && fields.endDate < fields.startDate) {
    problems.endDate = 'The end cannot be before the start.';
  }
  need('need', 'Describe the need it addressed.');
  need('approach', 'Describe what you did.');
  need('audience', 'Say who it was for.');
  if (!fields.funded) problems.funded = 'Say whether it was funded.';
  if (fields.funded === 'yes') need('funder', 'Say who funded it.');
  need('organisationName', 'Name the organisation that led it.');

  fields.organisations.forEach((row, index) => {
    if (!filled(row)) return;
    if (!text(row.name)) problems[`organisations.${index}.name`] = 'Name the organisation.';
    if (text(row.email) && !isValidEmail(row.email)) {
      problems[`organisations.${index}.email`] = 'That email does not look right.';
    }
  });
  fields.members.forEach((row, index) => {
    if (!filled(row)) return;
    if (!text(row.name)) problems[`members.${index}.name`] = 'Name the team member.';
    if (text(row.email) && !isValidEmail(row.email)) {
      problems[`members.${index}.email`] = 'That email does not look right.';
    }
  });
  fields.links.forEach((row, index) => {
    if (!filled(row)) return;
    if (!isValidUrl(row.url)) problems[`links.${index}.url`] = 'Enter a full web address, starting https://';
  });

  need('contactName', 'Enter your name.');
  if (!isValidEmail(fields.contactEmail)) problems.contactEmail = 'Enter a valid email, like name@example.org.';
  if (!fields.consent) problems.consent = 'Tick this so we may publish what you send.';

  return Object.keys(problems).length ? problems : null;
}

/**
 * The submission as saveSurveyResponse takes it: `source`, the contact `email`, and
 * everything else as the answers, trimmed, with empty rows left out and the funding
 * details only when it was funded. `hero` and `images` are the pictures as data URLs.
 */
export function caseStudyResponse(fields, { hero = null, images = [] } = {}) {
  const rows = (list, keys) => list.filter(filled)
    .map((row) => Object.fromEntries(keys.map((key) => [key, text(row[key])])));
  const funded = fields.funded === 'yes';
  return {
    source: CASE_STUDY_SOURCE,
    email: text(fields.contactEmail),
    title: text(fields.title),
    subtitle: text(fields.subtitle),
    place: text(fields.place),
    dates: { start: fields.startDate || null, end: fields.ongoing ? null : fields.endDate || null, ongoing: Boolean(fields.ongoing) },
    need: text(fields.need),
    approach: text(fields.approach),
    audience: text(fields.audience),
    outcome: text(fields.outcome),
    funding: {
      funded: fields.funded || null,
      funder: funded ? text(fields.funder) : '',
      amount: funded ? text(fields.amount) : '',
    },
    organisation: { name: text(fields.organisationName), wantsAccount: Boolean(fields.organisationAccount) },
    organisations: rows(fields.organisations, ['name', 'role', 'email']),
    members: rows(fields.members, ['name', 'role', 'email']),
    links: rows(fields.links, ['label', 'url']),
    contact: { name: text(fields.contactName), role: text(fields.contactRole) },
    consent: Boolean(fields.consent),
    hero,
    images,
  };
}
