import { describe, it, expect } from 'vite-plus/test';
import {
  MODULES,
  otherOption,
  questionType,
  resolveSurveyContent,
  scaleRange,
  validateSurveyContent,
} from '../placemakingSurvey/content';
import defaultContent from '../placemakingSurvey/content/default.json';

/** A deep copy, so a test can break one field without affecting the others. */
const clone = () => JSON.parse(JSON.stringify(defaultContent));

describe('placemaking trends survey content', () => {
  it('ships a valid survey', () => {
    const content = resolveSurveyContent();

    expect(content).toBe(resolveSurveyContent());
    expect(MODULES.every((module) => content[module].length > 0)).toBe(true);
    expect(MODULES.reduce((sum, module) => sum + content[module].length, 0)).toBe(12);
  });

  it('validates supplied content instead of the default', () => {
    const content = clone();
    content.cover.title = 'A different survey';

    expect(resolveSurveyContent(content).cover.title).toBe('A different survey');
  });

  it('rejects more than one anonymous opt-in', () => {
    const content = clone();
    content.optIns.forEach((entry) => {
      entry.anonymous = true;
    });

    expect(() => validateSurveyContent(content)).toThrow(/more than one opt-in as anonymous/);
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
      // Every shipped scale question sets its own range (1-5) now, so the default
      // is exercised directly against the function rather than real content.
      expect(scaleRange({ minLabel: 'a', maxLabel: 'b' })).toEqual([1, 10]);
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
      expect(content.cover.body[1]).toMatch(/about 5 minutes/);
    });

    it('rejects an empty body', () => {
      const content = clone();
      content.cover.body = [];

      expect(() => validateSurveyContent(content)).toThrow(/cover\.body/);
    });

    it('accepts a cover with no subtitle, but not an empty one', () => {
      const content = clone();
      delete content.cover.subtitle;
      expect(() => validateSurveyContent(content)).not.toThrow();

      content.cover.subtitle = ' ';
      expect(() => validateSurveyContent(content)).toThrow(/cover\.subtitle/);
    });
  });

  describe('the closing step', () => {
    it('ships the opt-ins, with the anonymous one last', () => {
      const content = resolveSurveyContent();

      expect(content.optIns.map((entry) => entry.key)).toEqual(['report', 'beta', 'anonymous']);
      expect(content.optIns[0].label).toMatch(/report/i);
      expect(content.optIns[1].label).toMatch(/beta test/i);
      // The step's description tells respondents to pick the last option.
      expect(content.optIns.at(-1).anonymous).toBe(true);
    });

    it('asks for a name, work email, municipality and department', () => {
      const content = resolveSurveyContent();

      expect(content.contact.fields.map((field) => field.key)).toEqual([
        'name',
        'email',
        'municipality',
        'department',
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
