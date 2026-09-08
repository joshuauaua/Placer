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
  ...SECTIONS.flatMap((section) => [`${section}Title`, `${section}Description`]),
  'emailTitle',
  'emailDescription',
  'consentLabel',
  'emailLabel',
  'emailPlaceholder',
  'nextLabel',
  'backLabel',
  'submitLabel',
  'submittingLabel',
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

  if (!Array.isArray(value.options) || value.options.length === 0) {
    fail(`${path}.options`, 'must be a non-empty array');
  }

  const seen = new Set();
  value.options.forEach((option, index) => {
    const optionPath = `${path}.options[${index}]`;
    object(option, optionPath);
    text(option.value, `${optionPath}.value`);
    text(option.label, `${optionPath}.label`);
    // A repeated value would make two buttons select as one.
    if (seen.has(option.value)) fail(`${optionPath}.value`, `repeats "${option.value}"`);
    seen.add(option.value);
  });
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
