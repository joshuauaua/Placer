/* PLACER — bug reports, from the floating "Report a bug" button.
 *
 * With a Supabase project configured a report is a row in public.bug_reports (see
 * supabase/bug-reports.sql), which the browser can add to and never read back. With
 * no project there is nowhere to send one, so the caller offers an email instead —
 * reportBugByEmailHref() builds that link from the same fields.
 */

import { getSupabase, isSupabaseConfigured } from './supabase';
import { OPERATOR } from '../legal';

export const BUG_REPORTS_TABLE = 'bug_reports';

// Matches the bug_reports_message_size constraint, so the form can stop somebody
// before the database does.
export const MAX_MESSAGE_LENGTH = 4000;

export { isSupabaseConfigured };

// The columns' own limit is 500; a query string can carry a lot, and none of it is
// needed to find the page again.
function context() {
  return {
    page: (window.location.pathname || '/').slice(0, 500),
    user_agent: (navigator.userAgent || '').slice(0, 500),
  };
}

/** File a report. Throws if there is no project, or the insert is refused. */
export async function submitBugReport(message) {
  const text = String(message ?? '').trim();
  if (!text) throw new Error('Describe the bug before sending it.');
  if (text.length > MAX_MESSAGE_LENGTH) {
    throw new Error(`Keep it under ${MAX_MESSAGE_LENGTH} characters.`);
  }

  const supabase = await getSupabase();
  if (!supabase) {
    throw new Error('Bug reports need a Supabase project: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  }

  // No .select(): the table has no read policy, so asking for the row back would fail.
  const { error } = await supabase.from(BUG_REPORTS_TABLE).insert({ message: text, ...context() });
  if (error) throw new Error(error.message || 'The report could not be sent.');
}

/** A mailto: link carrying the same report, for a build with no Supabase project. */
export function reportBugByEmailHref(message) {
  const { page, user_agent: userAgent } = context();
  const body = `${String(message ?? '').trim()}\n\n---\nPage: ${page}\nBrowser: ${userAgent}`;
  return `mailto:${OPERATOR.email}?subject=${encodeURIComponent('PLACER bug report')}`
    + `&body=${encodeURIComponent(body)}`;
}
