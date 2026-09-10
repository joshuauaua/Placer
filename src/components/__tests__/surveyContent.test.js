import { describe, it, expect } from 'vite-plus/test';
import { SECTIONS, resolveSurveyContent, validateSurveyContent } from '../survey/content';
import defaultContent from '../survey/content/default.json';
import practitionersContent from '../survey/content/practitioners.json';

/** A deep copy, so a test can break one field without affecting the others. */
const clone = () => JSON.parse(JSON.stringify(defaultContent));

/** The same, for the survey whose final step is lead capture. */
const clonePractitioners = () => JSON.parse(JSON.stringify(practitionersContent));

const countQuestions = (content) =>
  SECTIONS.reduce((sum, section) => sum + content[section].length, 0);

describe('survey content', () => {
  it('ships a valid survey', () => {
    const content = resolveSurveyContent();

    expect(content).toBe(resolveSurveyContent());
    expect(SECTIONS.every((section) => content[section].length > 0)).toBe(true);
    expect(countQuestions(content)).toBe(12);
    // The community survey keeps the consent box, not a contact block.
    expect(content.contact).toBeUndefined();
    expect(content.steps.consentLabel).toBeTruthy();
  });

  it('validates supplied content instead of the default', () => {
    const content = clone();
    content.hero.title = 'A different survey';

    expect(resolveSurveyContent(content).hero.title).toBe('A different survey');
  });

  it('rejects a missing copy field, naming it', () => {
    const content = clone();
    delete content.steps.submitLabel;

    expect(() => validateSurveyContent(content)).toThrow(/steps\.submitLabel/);
  });

  it('rejects an empty section', () => {
    const content = clone();
    content.section2 = [];

    expect(() => validateSurveyContent(content)).toThrow(/section2/);
  });

  it('rejects a question with no options', () => {
    const content = clone();
    content.section1[0].options = [];

    expect(() => validateSurveyContent(content)).toThrow(/section1\[0\]\.options/);
  });

  it('rejects a question key repeated within a section', () => {
    const content = clone();
    content.section1[1].key = content.section1[0].key;

    expect(() => validateSurveyContent(content)).toThrow(/repeats/);
  });

  it('accepts the same key in two different sections', () => {
    const content = clone();
    content.section2[0].key = content.section1[0].key;

    expect(() => validateSurveyContent(content)).not.toThrow();
  });

  it('rejects a repeated option value', () => {
    const content = clone();
    content.section1[0].options[1].value = content.section1[0].options[0].value;

    expect(() => validateSurveyContent(content)).toThrow(/section1\[0\]\.options\[1\]\.value/);
  });

  it('rejects a non-boolean multiple flag', () => {
    const content = clone();
    content.section3[0].multiple = 'yes';

    expect(() => validateSurveyContent(content)).toThrow(/section3\[0\]\.multiple/);
  });

  it('accepts the multiple and scale flags when they are booleans', () => {
    const content = clone();
    content.section3[0].multiple = true;
    content.section3[1].scale = true;

    expect(() => validateSurveyContent(content)).not.toThrow();
  });
});

describe('practitioners survey content', () => {
  it('ships a valid survey with a lead-capture final step', () => {
    const content = resolveSurveyContent(practitionersContent);

    expect(countQuestions(content)).toBe(6);
    expect(content.contact.fields.map((field) => field.key)).toEqual([
      'name',
      'organization',
      'email',
      'location',
    ]);
    // The tools question is the only multi-select, and its label leaves the
    // "select all that apply" line to SurveyQuestion rather than repeating it.
    const tools = content.section2.find((q) => q.key === 'currentTools');
    expect(tools.multiple).toBe(true);
    expect(tools.label).not.toMatch(/select all/i);
  });

  it('reveals the fields on answers the opt-in actually offers', () => {
    const { question, revealOn } = practitionersContent.contact;
    const offered = question.options.map((option) => option.value);

    expect(revealOn.every((answer) => offered.includes(answer))).toBe(true);
    // The declining answer must not reveal them, or the step always asks.
    expect(revealOn).not.toContain('no');
  });

  it('needs no consent copy, because it renders none', () => {
    const content = clonePractitioners();

    expect(content.steps.consentLabel).toBeUndefined();
    expect(() => validateSurveyContent(content)).not.toThrow();
  });

  it('rejects a revealOn answer the opt-in does not offer', () => {
    const content = clonePractitioners();
    content.contact.revealOn = ['maybe'];

    expect(() => validateSurveyContent(content)).toThrow(/contact\.revealOn\[0\]/);
  });

  it('rejects an empty revealOn', () => {
    const content = clonePractitioners();
    content.contact.revealOn = [];

    expect(() => validateSurveyContent(content)).toThrow(/contact\.revealOn/);
  });

  it('rejects a field with no label, naming it', () => {
    const content = clonePractitioners();
    delete content.contact.fields[1].label;

    expect(() => validateSurveyContent(content)).toThrow(/contact\.fields\[1\]\.label/);
  });

  it('rejects a repeated field key', () => {
    const content = clonePractitioners();
    content.contact.fields[1].key = content.contact.fields[0].key;

    expect(() => validateSurveyContent(content)).toThrow(/contact\.fields\[1\]\.key repeats/);
  });

  it('rejects a non-boolean required flag', () => {
    const content = clonePractitioners();
    content.contact.fields[0].required = 'yes';

    expect(() => validateSurveyContent(content)).toThrow(/contact\.fields\[0\]\.required/);
  });

  it('rejects an unknown field type', () => {
    const content = clonePractitioners();
    content.contact.fields[0].type = 'number';

    expect(() => validateSurveyContent(content)).toThrow(/contact\.fields\[0\]\.type/);
  });

  it('validates the opt-in with the same rules as any other question', () => {
    const content = clonePractitioners();
    content.contact.question.options = [];

    expect(() => validateSurveyContent(content)).toThrow(/contact\.question\.options/);
  });
});
