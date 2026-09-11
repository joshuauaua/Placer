import { describe, it, expect } from 'vite-plus/test';
import { SECTIONS, resolveSurveyContent, validateSurveyContent } from '../survey/content';
import defaultContent from '../survey/content/default.json';

/** A deep copy, so a test can break one field without affecting the others. */
const clone = () => JSON.parse(JSON.stringify(defaultContent));

describe('survey content', () => {
  it('ships a valid survey', () => {
    const content = resolveSurveyContent();

    expect(content).toBe(resolveSurveyContent());
    expect(SECTIONS.every((section) => content[section].length > 0)).toBe(true);
    expect(SECTIONS.reduce((sum, section) => sum + content[section].length, 0)).toBe(5);
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
    content.section2[1].key = content.section2[0].key;

    expect(() => validateSurveyContent(content)).toThrow(/repeats/);
  });

  it('rejects a non-boolean option flag, naming it', () => {
    const content = clone();
    content.section3[0].options[5].other = 'yes';

    expect(() => validateSurveyContent(content)).toThrow(/section3\[0\]\.options\[5\]\.other/);
  });

  it('rejects a second free-text option in one question', () => {
    const content = clone();
    content.section3[0].options[0].other = true;

    expect(() => validateSurveyContent(content)).toThrow(/more than one `other` option/);
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
