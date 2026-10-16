/* PLACER — keyboard shortcuts, and what they need to know about the keyboard.
 *
 *   ⌘K / Ctrl+K  opens the nav bar's search (NavSearch)
 *   N            starts a new project, for somebody signed in (App)
 *
 * The browser keeps ⌘N (a new window) and ⌘1–9 (switching tabs) for itself before a
 * page ever sees them, which is why neither is used.
 */

/** Whether this is a Mac, where the shortcut key is ⌘ rather than Ctrl. */
export function isMac() {
  if (typeof navigator === 'undefined') return false;
  return /Mac|iPhone|iPad|iPod/.test(navigator.userAgentData?.platform ?? navigator.platform ?? '');
}

/** The search shortcut as this keyboard writes it. */
export function searchShortcutLabel() {
  return isMac() ? '⌘K' : 'Ctrl+K';
}

/** Whether a key press is the search shortcut: ⌘K on a Mac, Ctrl+K elsewhere. */
export function isSearchShortcut(event) {
  return Boolean(event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey
    && event.key?.toLowerCase() === 'k';
}

/**
 * Whether a key press belongs to whatever is being typed into or used — a field, an
 * editable area, or a dialog that is open — and so is no shortcut, however it reads.
 */
export function isTyping(event) {
  const target = event.target;
  if (target?.isContentEditable) return true;
  if (target?.closest?.('input, textarea, select, [role="combobox"]')) return true;
  return Boolean(document.querySelector('[aria-modal="true"]'));
}

/** Whether a key press is the new-project shortcut: N on its own, outside any field. */
export function isNewProjectShortcut(event) {
  return event.key?.toLowerCase() === 'n' && !event.metaKey && !event.ctrlKey && !event.altKey
    && !event.shiftKey && !event.repeat && !isTyping(event);
}
