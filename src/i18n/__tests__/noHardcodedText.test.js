import { describe, it, expect } from 'vite-plus/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { hardcodedText } from '../hardcodedText';

/*
 * The screens that have moved to the dictionaries (src/i18n). Text written into one of
 * them directly would show in English whatever language is chosen, so this fails on
 * it: words between JSX tags, and the attributes people read or hear (a label, a
 * title, a placeholder). It does not see strings inside {…}, such as one half of a
 * ternary — those still need catching in review. Text that is not a sentence for
 * people — a file path — goes in the allow list beside the file, with why.
 *
 * Add a file here once it is translated.
 */
const TRANSLATED = {
  // The repository path a developer needs, not a sentence.
  'components/JoinPage.jsx': ['supabase/README.md'],
  'components/LanguagePicker.jsx': [],
  'components/ToolLayout.jsx': [],
  'components/toolkit/BudgetBallot.jsx': [],
  'components/toolkit/BudgetBallotParts.jsx': [],
  'components/toolkit/DreamIt.jsx': [],
  'components/toolkit/KeepOnProfile.jsx': [],
  'components/toolkit/OpenVote.jsx': [],
  'components/toolkit/PopQuiz.jsx': [],
  'components/toolkit/RoomBar.jsx': [],
  'components/toolkit/ToolCover.jsx': [],
  'components/toolkit/WordCloud.jsx': [],
};

describe('translated screens', () => {
  for (const [file, allowed] of Object.entries(TRANSLATED)) {
    it(`${file} has no text left in English`, () => {
      const source = readFileSync(join(import.meta.dirname, '../..', file), 'utf8');
      expect(hardcodedText(source).filter((text) => !allowed.includes(text))).toEqual([]);
    });
  }

  it('catches the kinds of text it is meant to', () => {
    expect(hardcodedText('<p>Join a room</p>')).toEqual(['Join a room']);
    expect(hardcodedText('<input placeholder="Type a word" />')).toEqual(['Type a word']);
    expect(hardcodedText('<Btn ariaLabel="Remove" />')).toEqual(['Remove']);
    expect(hardcodedText("<p>{text('join.title')}</p>")).toEqual([]);
    expect(hardcodedText('{/* A note for developers */}<span />')).toEqual([]);
    expect(hardcodedText('const ok = a > b && c < d;')).toEqual([]);
  });
});
