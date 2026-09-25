/* PLACER — survey content shape.
 *
 * The reference implementation this is ported from validates the content with a
 * zod schema. This project carries no schema library, so the same checks are
 * spelled out here. They run once, when the content is resolved, and throw with
 * the offending path — a malformed survey should fail at the seam rather than
 * render a screen of `undefined`.
 */

import defaultContent from './content/default.json';

/** The three question sections, in the order they are asked. */
export const SECTIONS = ['section1', 'section2', 'section3'];

/** Every step of the flow, including the ones that ask nothing. */
export const STEPS = ['intro', ...SECTIONS, 'email', 'success'];

const HERO_FIELDS = ['title', 'subtitle', 'startLabel'];

const STEP_FIELDS = [
  // A title each. The question on screen is its own heading, so sections carry
  // no blurb above it.
  ...SECTIONS.map((section) => `${section}Title`),
  'emailTitle',
  'emailDescription',
  'emailRequiredDescription',
  'emailLabel',
  'emailPlaceholder',
  'otherLabel',
  'otherPlaceholder',
  'nextLabel',
  'backLabel',
  'submitLabel',
  'submittingLabel',
  // The line above Submit, with the Terms and Privacy page as its link.
  'termsNotice',
  'termsLinkLabel',
];

const SUCCESS_FIELDS = ['title', 'body', 'closeLabel'];

function fail(path, problem) {
  throw new Error(`survey content: ${path} ${problem}`);
}

function object(value, path) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail(path, 'must be an object');
  }
  return value;
}

function text(value, path) {
  if (typeof value !== 'string' || value.trim() === '') {
    fail(path, 'must be a non-empty string');
  }
  return value;
}

/** A count that may be absent, but must be a positive whole number when present. */
function optionalCount(value, path) {
  if (value === undefined) return value;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    fail(path, 'must be a positive whole number when present');
  }
  return value;
}

/** Text that may be absent altogether, but must be real text when it is there. */
function optionalText(value, path) {
  if (value === undefined) return value;
  return text(value, path);
}

function flag(value, path) {
  if (value !== undefined && typeof value !== 'boolean') {
    fail(path, 'must be a boolean when present');
  }
  return value;
}

function fields(value, names, path) {
  object(value, path);
  names.forEach((name) => text(value[name], `${path}.${name}`));
}

function question(value, path) {
  object(value, path);
  text(value.key, `${path}.key`);
  text(value.label, `${path}.label`);
  flag(value.multiple, `${path}.multiple`);
  flag(value.scale, `${path}.scale`);
  flag(value.rank, `${path}.rank`);

  // Ranking is an ordering of several answers, so it needs `multiple` to store
  // one: on its own it would rank a single choice against nothing.
  if (value.rank && !value.multiple) fail(`${path}.rank`, 'needs `multiple` alongside it');

  // A ceiling on how many answers may be picked. Single-choice questions already
  // hold exactly one, so a limit there would mean nothing.
  optionalCount(value.maxChoices, `${path}.maxChoices`);
  if (value.maxChoices !== undefined && !value.multiple) {
    fail(`${path}.maxChoices`, 'needs `multiple` alongside it');
  }

  if (!Array.isArray(value.options) || value.options.length === 0) {
    fail(`${path}.options`, 'must be a non-empty array');
  }

  const seen = new Set();
  let others = 0;
  value.options.forEach((option, index) => {
    const optionPath = `${path}.options[${index}]`;
    object(option, optionPath);
    text(option.value, `${optionPath}.value`);
    text(option.label, `${optionPath}.label`);
    // An optional trailing clause, shown after the label on the same line with the
    // label emboldened ahead of it. Splitting the two is what lets the title be
    // picked out; an option with no description renders as a plain label.
    optionalText(option.description, `${optionPath}.description`);
    // `other` opens a free-text field; `noCommitment` marks the answer that
    // leaves the closing email step optional.
    flag(option.other, `${optionPath}.other`);
    flag(option.noCommitment, `${optionPath}.noCommitment`);
    if (option.other) others += 1;
    // A repeated value would make two buttons select as one.
    if (seen.has(option.value)) fail(`${optionPath}.value`, `repeats "${option.value}"`);
    seen.add(option.value);
  });

  // One free-text field per question: a second would have nowhere to be stored.
  if (others > 1) fail(`${path}.options`, 'has more than one `other` option');

  // A limit above the number of options could never be reached, so it is a mistake
  // rather than a permissive setting.
  if (value.maxChoices !== undefined && value.maxChoices > value.options.length) {
    fail(`${path}.maxChoices`, 'is larger than the number of options');
  }
}

/**
 * Throws unless `content` is a complete survey. Returns it unchanged so it can
 * be used inline.
 */
export function validateSurveyContent(content) {
  object(content, 'content');
  fields(content.hero, HERO_FIELDS, 'hero');
  fields(content.steps, STEP_FIELDS, 'steps');
  fields(content.success, SUCCESS_FIELDS, 'success');
  text(content.errorMessage, 'errorMessage');

  SECTIONS.forEach((section) => {
    const questions = content[section];
    if (!Array.isArray(questions) || questions.length === 0) {
      fail(section, 'must be a non-empty array');
    }

    const seen = new Set();
    questions.forEach((entry, index) => {
      const path = `${section}[${index}]`;
      question(entry, path);
      // Answers are stored per section under the question key, so a repeat
      // inside one section would silently overwrite an answer.
      if (seen.has(entry.key)) fail(`${path}.key`, `repeats "${entry.key}"`);
      seen.add(entry.key);
    });
  });

  return content;
}

const fallbackContent = validateSurveyContent(defaultContent);

/**
 * Supplied content when there is any, otherwise the survey shipped in
 * `content/default.json`. The argument is the seam a CMS would fill.
 */
export function resolveSurveyContent(content) {
  return content ? validateSurveyContent(content) : fallbackContent;
}
