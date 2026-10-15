/* PLACER — finding text written straight into a translated screen, which would stay in
 * English whatever language is chosen (__tests__/noHardcodedText.test.js).
 */

const SPOKEN = ['title', 'label', 'placeholder', 'aria-label', 'ariaLabel', 'alt', 'fieldLabel', 'copiedLabel',
  'legend', 'description', 'note', 'action'];

/** Comments say what the code does in English, and are not on screen. */
const withoutComments = (source) => source
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

/** Words a person would read, found where JSX puts text or a spoken attribute. */
export function hardcodedText(source) {
  const code = withoutComments(source);
  const found = [];
  // Text between a tag's end and the next tag: `>Join a room<`. Code between an arrow
  // and a tag has brackets or operators in it; a sentence does not.
  for (const [, text] of code.matchAll(/>([^<>{}]*)</g)) {
    const words = text.replace(/&\w+;/g, ' ').trim();
    if (/[A-Za-z]{2,}/.test(words) && !/[()=;:[\]|&?]/.test(words)) found.push(words);
  }
  for (const [, , text] of code.matchAll(new RegExp(`\\b(${SPOKEN.join('|')})=["']([^"']*)["']`, 'g'))) {
    if (/[A-Za-z]{2,}/.test(text)) found.push(text);
  }
  return found;
}
