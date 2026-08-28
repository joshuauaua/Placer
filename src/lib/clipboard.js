/* PLOT — copy to clipboard, for browsers that allow it and browsers that do not.
 *
 * The async Clipboard API is missing in older browsers, absent outside a secure
 * context, and rejects outright if the permission is refused. Callers need to know
 * which of those happened, because the honest fallback is to show the text and let
 * the visitor copy it themselves.
 */

/** @returns {Promise<boolean>} whether the text made it to the clipboard. */
export async function copyText(text) {
  try {
    if (!navigator?.clipboard?.writeText) return false;
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
