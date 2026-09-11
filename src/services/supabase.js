/* PLACER — the Supabase client.
 *
 * Optional in the same way PostHog is: with either variable missing there is no
 * client, and callers fall back to localStorage so the app still runs with no
 * backend at all (see services/api.js).
 *
 * The anon key belongs in the bundle. It is a public identifier, and what keeps
 * the data safe is row-level security on the table, not hiding the key — the
 * policy in supabase/schema.sql lets the anon role insert a response and read
 * nothing back. A service_role key must NEVER be put in a VITE_ variable:
 * everything so prefixed is compiled into the JavaScript the browser downloads.
 */

import { createClient } from '@supabase/supabase-js';

/** The table survey responses are appended to. */
export const SURVEY_TABLE = 'survey_responses';

// Read at call time rather than module load so tests can stub the environment,
// matching isAnalyticsConfigured() in src/analytics.js.
export function isSupabaseConfigured() {
  return Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
}

let client = null;
// What the cached client was built from, so a stubbed environment in one test
// does not hand a stale client to the next.
let builtFrom = null;

/** The shared client, or null when no project is configured. */
export function getSupabase() {
  if (!isSupabaseConfigured()) return null;

  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const signature = `${url}|${anonKey}`;

  if (!client || builtFrom !== signature) {
    client = createClient(url, anonKey, {
      // Nobody signs in, so there is no session to keep and no reason to write
      // one to localStorage or to refresh a token in the background.
      auth: { persistSession: false, autoRefreshToken: false },
    });
    builtFrom = signature;
  }

  return client;
}
