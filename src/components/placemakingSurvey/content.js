/* PLACER — survey content shape.
 *
 * The reference implementation this is ported from validates the content with a
 * zod schema. This project carries no schema library, so the same checks are
 * spelled out here. They run once, when the content is resolved, and throw with
 * the offending path — a malformed survey should fail at the seam rather than
 * render a screen of `undefined`.
 *
 * Ported from the Development branch's src/components/survey/, which by then had
 * outgrown this branch's own shorter src/components/survey/ (three sections, one
 * choice-question type, an unconditional email step — see that module's content.js
 * for the survey it still runs). Kept as its own tree rather than merged into that
 * one: the two content shapes do not overlap enough to share a schema without
 * either survey carrying fields the other has no use for.
 */

import defaultContent from './content/default.json';

/** The four question modules, in the order they are asked. */
export const MODULES = ['module1', 'module2', 'module3', 'module4'];

/** Every step of the flow, including the ones that ask nothing. */
export const STEPS = ['cover', ...MODULES, 'optIn', 'success'];

/**
 * What a question can be. `choice` is a group of option buttons — the only kind
 * the survey had before — and is what a question with no `type` means, so the
 * content stays readable where the type adds nothing.
 */
export const QUESTION_TYPES = ['choice', 'scale', 'text', 'paragraph'];

/** Ends of a `scale` question when its content does not say otherwise. */
export const SCALE_MIN = 1;
export const SCALE_MAX = 10;

const COVER_FIELDS = ['title', 'startLabel'];

const STEP_FIELDS = [
  ...MODULES.map((module) => `${module}Title`),
  'optInTitle',
  // Shown against an `other` option and an `optional` question respectively, so
  // both live in the content rather than in the components.
  'otherLabel',
  'otherPlaceholder',
  'optionalHint',
  // The Enter-to-continue hint. Read by the cover as well as the question steps,
  // because it is chrome the whole survey shares rather than cover copy.
  'enterKeyLabel',
  'enterHintStart',
  'enterHint',
  'enterHintSubmit',
  'newLineHint',
  'nextLabel',
  'backLabel',
  'submitLabel',
  'submittingLabel',
];

const SUCCESS_FIELDS = ['title', 'body', 'closeLabel'];

const CONTACT_FIELD_TYPES = ['text', 'email'];

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

function optionalText(value, path) {
  if (value !== undefined) text(value, path);
  return value;
}

function flag(value, path) {
  if (value !== undefined && typeof value !== 'boolean') {
    fail(path, 'must be a boolean when present');
  }
  return value;
}

function optionalInteger(value, path) {
  if (value !== undefined && (!Number.isInteger(value) || value < 0)) {
    fail(path, 'must be a non-negative integer when present');
  }
  return value;
}

function fields(value, names, path) {
  object(value, path);
  names.forEach((name) => text(value[name], `${path}.${name}`));
}

/** A non-empty array of objects with unique `key`s, e.g. the opt-ins. */
function keyedList(value, path, each) {
  if (!Array.isArray(value) || value.length === 0) {
    fail(path, 'must be a non-empty array');
  }

  const seen = new Set();
  value.forEach((entry, index) => {
    const entryPath = `${path}[${index}]`;
    object(entry, entryPath);
    text(entry.key, `${entryPath}.key`);
    if (seen.has(entry.key)) fail(`${entryPath}.key`, `repeats "${entry.key}"`);
    seen.add(entry.key);
    each?.(entry, entryPath);
  });
}

function cover(value, path) {
  fields(value, COVER_FIELDS, path);
  // A line under the title. Optional, so a cover without one still validates.
  optionalText(value.subtitle, `${path}.subtitle`);

  if (!Array.isArray(value.body) || value.body.length === 0) {
    fail(`${path}.body`, 'must be a non-empty array of paragraphs');
  }
  value.body.forEach((paragraph, index) => text(paragraph, `${path}.body[${index}]`));
}

function choiceOptions(value, path) {
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
    flag(option.other, `${optionPath}.other`);
    if (option.other) others += 1;
    // A repeated value would make two buttons select as one.
    if (seen.has(option.value)) fail(`${optionPath}.value`, `repeats "${option.value}"`);
    seen.add(option.value);
  });

  // The free text is stored once per question, so two `other` options would
  // write over each other.
  if (others > 1) fail(`${path}.options`, 'marks more than one option as other');
}

function question(value, path) {
  object(value, path);
  text(value.key, `${path}.key`);
  text(value.label, `${path}.label`);
  flag(value.optional, `${path}.optional`);

  const type = questionType(value);
  if (!QUESTION_TYPES.includes(type)) {
    fail(`${path}.type`, `must be one of ${QUESTION_TYPES.join(', ')}`);
  }

  if (type === 'choice') {
    flag(value.multiple, `${path}.multiple`);
    flag(value.scale, `${path}.scale`);
    choiceOptions(value, path);
    return;
  }

  if (type === 'scale') {
    // Both ends are labelled because a bare 1-10 strip does not say which end
    // is good; every scale question in the survey spells that out.
    text(value.minLabel, `${path}.minLabel`);
    text(value.maxLabel, `${path}.maxLabel`);
    optionalInteger(value.scaleMin, `${path}.scaleMin`);
    optionalInteger(value.scaleMax, `${path}.scaleMax`);
    const [min, max] = scaleRange(value);
    if (max <= min) fail(`${path}.scaleMax`, 'must be greater than scaleMin');
    return;
  }

  optionalText(value.placeholder, `${path}.placeholder`);
  optionalInteger(value.maxLength, `${path}.maxLength`);
}

/** The type a question is asked as. Absent means the original option buttons. */
export function questionType(question) {
  return question.type ?? 'choice';
}

/** The inclusive ends of a `scale` question, defaulted. */
export function scaleRange(question) {
  return [question.scaleMin ?? SCALE_MIN, question.scaleMax ?? SCALE_MAX];
}

/** The one option a `choice` question marks as `other`, if it has one. */
export function otherOption(question) {
  if (questionType(question) !== 'choice') return undefined;
  return question.options.find((option) => option.other);
}

/**
 * Throws unless `content` is a complete survey. Returns it unchanged so it can
 * be used inline.
 */
export function validateSurveyContent(content) {
  object(content, 'content');
  cover(content.cover, 'cover');
  fields(content.steps, STEP_FIELDS, 'steps');
  // Copy above the closing step's details. Optional, so the step can open straight
  // on the contact fields.
  optionalText(content.steps.optInDescription, 'steps.optInDescription');
  fields(content.success, SUCCESS_FIELDS, 'success');
  text(content.errorMessage, 'errorMessage');

  // The closing step: what a respondent can ask for, and how we reach them.
  keyedList(content.optIns, 'optIns', (entry, path) => {
    text(entry.label, `${path}.label`);
    // Ticking an `anonymous` opt-in clears the details and every other opt-in.
    flag(entry.anonymous, `${path}.anonymous`);
  });
  if (content.optIns.filter((entry) => entry.anonymous).length > 1) {
    fail('optIns', 'marks more than one opt-in as anonymous');
  }

  object(content.contact, 'contact');
  text(content.contact.title, 'contact.title');
  optionalText(content.contact.description, 'contact.description');
  keyedList(content.contact.fields, 'contact.fields', (field, path) => {
    text(field.label, `${path}.label`);
    optionalText(field.placeholder, `${path}.placeholder`);
    if (field.type !== undefined && !CONTACT_FIELD_TYPES.includes(field.type)) {
      fail(`${path}.type`, `must be one of ${CONTACT_FIELD_TYPES.join(', ')}`);
    }
  });

  // The contact step shows unconditionally (see SurveyForm/useSurveyForm) and an
  // address left with no way to answer it is a dead end — so one is not negotiable.
  if (!content.contact.fields.some((field) => field.type === 'email')) {
    fail('contact.fields', 'must include a field of type email');
  }

  MODULES.forEach((module) => {
    const questions = content[module];
    if (!Array.isArray(questions) || questions.length === 0) {
      fail(module, 'must be a non-empty array');
    }

    const seen = new Set();
    questions.forEach((entry, index) => {
      const path = `${module}[${index}]`;
      question(entry, path);
      // Answers are stored per module under the question key, so a repeat
      // inside one module would silently overwrite an answer.
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
