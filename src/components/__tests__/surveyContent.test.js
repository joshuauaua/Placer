import { describe, it, expect } from 'vite-plus/test';
import {
  MODULES,
  otherOption,
  questionType,
  resolveSurveyContent,
  scaleRange,
  validateSurveyContent,
} from '../survey/content';
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
    expect(MODULES.every((module) => content[module].length > 0)).toBe(true);
    expect(MODULES.reduce((sum, module) => sum + content[module].length, 0)).toBe(17);
  });

  it('validates supplied content instead of the default', () => {
    const content = clone();
    content.cover.title = 'A different survey';

    expect(resolveSurveyContent(content).cover.title).toBe('A different survey');
  });

  it('rejects a missing copy field, naming it', () => {
    const content = clone();
    delete content.steps.submitLabel;

    expect(() => validateSurveyContent(content)).toThrow(/steps\.submitLabel/);
  });

  it('rejects an empty module', () => {
    const content = clone();
    content.module2 = [];

    expect(() => validateSurveyContent(content)).toThrow(/module2/);
  });

  it('rejects a choice question with no options', () => {
    const content = clone();
    content.module1[0].options = [];

    expect(() => validateSurveyContent(content)).toThrow(/module1\[0\]\.options/);
  });

  it('rejects a question key repeated within a module', () => {
    const content = clone();
    content.module1[1].key = content.module1[0].key;

    expect(() => validateSurveyContent(content)).toThrow(/repeats/);
  });

  it('accepts the same key in two different modules', () => {
    const content = clone();
    content.module2[0].key = content.module1[0].key;

    expect(() => validateSurveyContent(content)).not.toThrow();
  });

  it('rejects a repeated option value', () => {
    const content = clone();
    content.module1[0].options[1].value = content.module1[0].options[0].value;

    expect(() => validateSurveyContent(content)).toThrow(/module1\[0\]\.options\[1\]\.value/);
  });

  it('rejects a non-boolean multiple flag', () => {
    const content = clone();
    content.module1[0].multiple = 'yes';

    expect(() => validateSurveyContent(content)).toThrow(/module1\[0\]\.multiple/);
  });

  it('accepts the multiple and scale flags when they are booleans', () => {
    const content = clone();
    content.module1[0].multiple = true;
    content.module1[2].scale = true;

    expect(() => validateSurveyContent(content)).not.toThrow();
  });

  it('rejects an unknown question type', () => {
    const content = clone();
    content.module1[0].type = 'slider';

    expect(() => validateSurveyContent(content)).toThrow(/module1\[0\]\.type/);
  });

  it('rejects a second option marked as other', () => {
    const content = clone();
    content.module1[0].options[0].other = true;

    expect(() => validateSurveyContent(content)).toThrow(/module1\[0\]\.options.*more than one/);
  });

  describe('scale questions', () => {
    /** The index of the first scale question in module 2. */
    const scaleIndex = (content) =>
      content.module2.findIndex((question) => question.type === 'scale');

    it('defaults to a 1-10 range', () => {
      const content = resolveSurveyContent();
      expect(scaleRange(content.module2[scaleIndex(content)])).toEqual([1, 10]);
    });

    it('honours an explicit range', () => {
      const content = clone();
      const question = content.module2[scaleIndex(content)];
      question.scaleMin = 0;
      question.scaleMax = 5;

      expect(validateSurveyContent(content)).toBe(content);
      expect(scaleRange(question)).toEqual([0, 5]);
    });

    it('rejects a range that runs backwards', () => {
      const content = clone();
      const question = content.module2[scaleIndex(content)];
      question.scaleMin = 8;
      question.scaleMax = 2;

      expect(() => validateSurveyContent(content)).toThrow(/scaleMax/);
    });

    it('requires both ends to be labelled', () => {
      const content = clone();
      delete content.module2[scaleIndex(content)].maxLabel;

      expect(() => validateSurveyContent(content)).toThrow(/maxLabel/);
    });

    it('needs no options', () => {
      const content = resolveSurveyContent();
      expect(content.module2[scaleIndex(content)].options).toBeUndefined();
    });
  });

  describe('the cover page', () => {
    it('carries the invitation as paragraphs', () => {
      const content = resolveSurveyContent();

      expect(content.cover.body.length).toBeGreaterThan(1);
      expect(content.cover.body[1]).toMatch(/about 7 minutes/);
    });

    it('rejects an empty body', () => {
      const content = clone();
      content.cover.body = [];

      expect(() => validateSurveyContent(content)).toThrow(/cover\.body/);
    });

    it('rejects a glossary entry with no definition', () => {
      const content = clone();
      delete content.cover.glossary[0].definition;

      expect(() => validateSurveyContent(content)).toThrow(/cover\.glossary\[0\]\.definition/);
    });

    it('rejects a glossary with no title above it', () => {
      const content = clone();
      delete content.cover.glossaryTitle;

      expect(() => validateSurveyContent(content)).toThrow(/cover\.glossaryTitle/);
    });

    it('accepts a survey with no glossary at all', () => {
      const content = clone();
      delete content.cover.glossary;
      delete content.cover.glossaryTitle;

      expect(() => validateSurveyContent(content)).not.toThrow();
    });
  });

  describe('the closing step', () => {
    it('ships the three opt-ins', () => {
      const content = resolveSurveyContent();

      expect(content.optIns.map((entry) => entry.key)).toEqual(['report', 'beta', 'demo']);
      expect(content.optIns[0].label).toMatch(/Placemaking Trends/);
    });

    it('asks for a name, city, department and work email', () => {
      const content = resolveSurveyContent();

      expect(content.contact.fields.map((field) => field.key)).toEqual([
        'name',
        'city',
        'department',
        'email',
      ]);
    });

    it('rejects a repeated opt-in key', () => {
      const content = clone();
      content.optIns[1].key = content.optIns[0].key;

      expect(() => validateSurveyContent(content)).toThrow(/optIns\[1\]\.key/);
    });

    it('rejects contact fields with no address among them', () => {
      const content = clone();
      content.contact.fields = content.contact.fields.filter((field) => field.type !== 'email');

      expect(() => validateSurveyContent(content)).toThrow(/contact\.fields/);
    });
  });

  describe('question helpers', () => {
    it('treats a typeless question as a choice', () => {
      expect(questionType({ key: 'k', label: 'l', options: [] })).toBe('choice');
    });

    it('finds the other option, and only on a choice question', () => {
      const content = resolveSurveyContent();

      expect(otherOption(content.module1[0]).value).toBe('other');
      expect(otherOption(content.module1[2])).toBeUndefined();
      expect(otherOption(content.module2[2])).toBeUndefined();
    });
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
