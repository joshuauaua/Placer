/* PLACER — moving between cards with the arrow keys.
 *
 * A gallery of cards is a row of Tab stops otherwise, one per card. With this as the
 * onKeyDown of what holds them, the arrow keys move focus between the cards marked
 * with `data-arrow-item` (ARROW_ITEM), and Enter — every card being a button — opens
 * the one in focus, as it always did:
 *
 *   ← →        the card before or after, in the order they are listed
 *   ↑ ↓        the nearest card in the row above or below, as they are laid out
 *              (in a list, one row each, that is simply the one before or after)
 *   Home End   the first or the last
 *
 * Only from a card: keys pressed in a field, or on anything else in the container,
 * are left alone.
 */

export const ARROW_ITEM = { 'data-arrow-item': '' };

const KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];

// How far apart two tops can be and still count as one row.
const ROW_SLACK = 8;

/** The card in the row above (-1) or below (1) whose middle is nearest this one's. */
function inRow(items, from, direction) {
  const here = from.getBoundingClientRect();
  const middle = here.left + here.width / 2;
  const candidates = items
    .map((item) => ({ item, box: item.getBoundingClientRect() }))
    .filter(({ item, box }) => item !== from && (direction > 0 ? box.top >= here.bottom - 1 : box.bottom <= here.top + 1))
    .map(({ item, box }) => ({
      item,
      dy: direction > 0 ? box.top - here.bottom : here.top - box.bottom,
      dx: Math.abs(box.left + box.width / 2 - middle),
    }));
  if (candidates.length === 0) return null;
  const nearest = Math.min(...candidates.map(({ dy }) => dy));
  return candidates
    .filter(({ dy }) => dy <= nearest + ROW_SLACK)
    .sort((a, b) => a.dx - b.dx)[0].item;
}

/** The onKeyDown for whatever holds the cards. */
export function moveWithArrows(event) {
  if (!KEYS.includes(event.key) || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
  const from = event.target.closest?.('[data-arrow-item]');
  if (!from || !event.currentTarget.contains(from)) return;

  const items = [...event.currentTarget.querySelectorAll('[data-arrow-item]')]
    .filter((item) => !item.disabled);
  const index = items.indexOf(from);
  const box = from.getBoundingClientRect();
  // Laid out, or not (a test's document has no layout): rows by position, or by order.
  const laidOut = box.width > 0 || box.height > 0;

  let next = null;
  if (event.key === 'Home') next = items[0];
  else if (event.key === 'End') next = items[items.length - 1];
  else if (event.key === 'ArrowLeft') next = items[index - 1];
  else if (event.key === 'ArrowRight') next = items[index + 1];
  else {
    const direction = event.key === 'ArrowDown' ? 1 : -1;
    next = laidOut ? inRow(items, from, direction) : items[index + direction];
  }

  if (!next || next === from) return;
  event.preventDefault();
  next.focus();
}
