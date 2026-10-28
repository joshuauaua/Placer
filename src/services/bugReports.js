/* PLACER — bug reports, from the floating "Report a bug" button.
 *
 * With a Supabase project configured a report is a row in public.bug_reports (see
 * supabase/bug-reports.sql), which the browser can add to and never read back. With
 * no project there is nowhere to send one, so the caller offers an email instead —
 * reportBugByEmailHref() builds that link from the same fields.
 *
 * Somebody signed in may attach a screenshot. Like a case study's picture it is
 * re-encoded first (preparePhoto: WebP, at most 1920px, no metadata), goes to R2 through
 * the media function under 'bug-reports/<user id>/', and the row keeps its key
 * (supabase/bug-report-screenshots.sql).
 */

import { getSupabase, isSupabaseConfigured } from './supabase';
import { isMediaConfigured, preparePhoto, removeMedia, uploadPhoto } from './media';
import { OPERATOR } from '../legal';
import { track } from '../analytics';

export const BUG_REPORTS_TABLE = 'bug_reports';

// Matches the bug_reports_message_size constraint, so the form can stop somebody
// before the database does.
export const MAX_MESSAGE_LENGTH = 4000;

export { isSupabaseConfigured };

/** Whether attaching a screenshot can work at all in this build. */
export function canAttachScreenshot() {
  return isSupabaseConfigured() && isMediaConfigured();
}

/**
 * Whether somebody is signed in, and so has a folder to upload a screenshot to. The
 * button sits outside the app's routes (so it survives a crashed page), away from the
 * identity the rest of the app shares, so it asks the session itself.
 */
export async function readSignedIn() {
  const supabase = await getSupabase();
  if (!supabase) return false;
  const { data } = await supabase.auth.getSession();
  return Boolean(data?.session?.user?.id);
}

// The columns' own limit is 500; a query string can carry a lot, and none of it is
// needed to find the page again.
function context() {
  return {
    page: (window.location.pathname || '/').slice(0, 500),
    user_agent: (navigator.userAgent || '').slice(0, 500),
  };
}

/**
 * File a report, with an optional `screenshot` (a File or Blob). Throws if there is no
 * project, the screenshot is refused, or the insert is refused.
 */
export async function submitBugReport(message, { screenshot = null } = {}) {
  const text = String(message ?? '').trim();
  if (!text) throw new Error('Describe the bug before sending it.');
  if (text.length > MAX_MESSAGE_LENGTH) {
    throw new Error(`Keep it under ${MAX_MESSAGE_LENGTH} characters.`);
  }

  const supabase = await getSupabase();
  if (!supabase) {
    throw new Error('Bug reports need a Supabase project: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  }

  const row = { message: text, ...context() };
  if (screenshot) {
    const { data: session } = await supabase.auth.getSession();
    const userId = session?.session?.user?.id;
    if (!userId) throw new Error('Sign in to attach a screenshot.');
    const photo = await preparePhoto(screenshot, 'screenshot', 'A screenshot');
    try {
      row.screenshot_path = await uploadPhoto(supabase, `bug-reports/${userId}/${crypto.randomUUID()}`, photo);
    } catch (uploadError) {
      throw new Error(`Could not upload the screenshot: ${uploadError.message}`);
    }
  }

  // No .select(): the table has no read policy, so asking for the row back would fail.
  const { error } = await supabase.from(BUG_REPORTS_TABLE).insert(row);
  if (error) {
    // Tidiness, not correctness: a screenshot no report points at would only take up room.
    if (row.screenshot_path) {
      await removeMedia(supabase, row.screenshot_path)
        .catch((storageError) => console.error('Could not remove the unused screenshot:', storageError));
    }
    throw new Error(error.message || 'The report could not be sent.');
  }
  track('bug_report_submitted', { screenshot: Boolean(row.screenshot_path) });
}

/** A mailto: link carrying the same report, for a build with no Supabase project. */
export function reportBugByEmailHref(message) {
  const { page, user_agent: userAgent } = context();
  const body = `${String(message ?? '').trim()}\n\n---\nPage: ${page}\nBrowser: ${userAgent}`;
  return `mailto:${OPERATOR.email}?subject=${encodeURIComponent('PLACER bug report')}`
    + `&body=${encodeURIComponent(body)}`;
}
