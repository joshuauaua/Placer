/* PLACER — tool submissions, from the Sandbox's "Contribute" form.
 *
 * Somebody with a tool they would like in the PLACER Toolkit sends its name, a
 * description and an email address. With a Supabase project configured that is a row
 * in public.tool_submissions (see supabase/tool-submissions.sql), which the browser can
 * add to and never read back. With no project there is nowhere to send one, so the
 * caller offers an email instead — submitToolByEmailHref() builds that link from the
 * same fields.
 */

import { getSupabase, isSupabaseConfigured } from './supabase';
import { OPERATOR } from '../legal';

export const TOOL_SUBMISSIONS_TABLE = 'tool_submissions';

// Match the table's constraints, so the form can stop somebody before the database does.
export const MAX_TITLE_LENGTH = 200;
export const MAX_DESCRIPTION_LENGTH = 4000;
export const MAX_EMAIL_LENGTH = 320;

export { isSupabaseConfigured };

// Loose on purpose, and the same test as tool_submissions_email_shape: it catches a
// typo'd or missing address, not every address a mail server would refuse.
export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email ?? '').trim());
}

function clean({ title, description, email }) {
  return {
    title: String(title ?? '').trim(),
    description: String(description ?? '').trim(),
    email: String(email ?? '').trim(),
  };
}

/** Why a submission would be refused, or null if it is fine to send. */
export function validateToolSubmission(fields) {
  const { title, description, email } = clean(fields);
  if (!title) return 'Give the tool a title.';
  if (title.length > MAX_TITLE_LENGTH) return `Keep the title under ${MAX_TITLE_LENGTH} characters.`;
  if (!description) return 'Describe what the tool does.';
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    return `Keep the description under ${MAX_DESCRIPTION_LENGTH} characters.`;
  }
  if (!isValidEmail(email) || email.length > MAX_EMAIL_LENGTH) return 'Enter an email address we can reach you at.';
  return null;
}

/** Send a submission. Throws if it is incomplete, there is no project, or the insert is refused. */
export async function submitTool(fields) {
  const problem = validateToolSubmission(fields);
  if (problem) throw new Error(problem);

  const supabase = await getSupabase();
  if (!supabase) {
    throw new Error('Tool submissions need a Supabase project: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  }

  // No .select(): the table has no read policy, so asking for the row back would fail.
  const { error } = await supabase.from(TOOL_SUBMISSIONS_TABLE).insert(clean(fields));
  if (error) throw new Error(error.message || 'The submission could not be sent.');
}

/** A mailto: link carrying the same submission, for a build with no Supabase project. */
export function submitToolByEmailHref(fields) {
  const { title, description, email } = clean(fields);
  const body = `${description}\n\n---\nTool: ${title}\nContact: ${email}`;
  return `mailto:${OPERATOR.email}?subject=${encodeURIComponent(`PLACER Toolkit submission: ${title}`)}`
    + `&body=${encodeURIComponent(body)}`;
}
