/* PLACER — the Supabase client.
 *
 * Optional in the same way PostHog is: with either variable missing there is no
 * client, and every caller has to cope with that. Most of the app stores what it
 * needs in localStorage and carries on; two features cannot, and say so plainly
 * rather than pretending to work. Sandbox rooms, because a room is shared between
 * devices by definition (services/rooms.js). And accounts, because there is nowhere
 * to keep one — with no project configured the app falls back to the localStorage
 * identity in services/profile.js, which is what it used before accounts existed
 * (services/auth.js, and the branch in components/useIdentity.js).
 *
 * The anon key belongs in the bundle. It is a public identifier, and what keeps
 * the data safe is row-level security on the table, not hiding the key — the
 * rules in supabase/rooms.sql give the anon role no access at all to the rooms
 * table and a single column-limited read of the contributions. A service_role key
 * must NEVER be put in a VITE_ variable: everything so prefixed is compiled into
 * the JavaScript the browser downloads.
 *
 * The SDK is imported on demand rather than at the top of this file. It is 70kB
 * gzipped, and most of what it can do this app never asks for — importing it
 * statically would put all of it on the Sandbox page for everybody, including the
 * visitors who never open a room. isSupabaseConfigured() stays synchronous, because
 * it only reads two environment variables and the UI needs the answer while it is
 * deciding what to render.
 */

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
export async function getSupabase() {
  if (!isSupabaseConfigured()) return null;

  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const signature = `${url}|${anonKey}`;

  if (!client || builtFrom !== signature) {
    const { createClient } = await import('@supabase/supabase-js');
    client = createClient(url, anonKey, {
      auth: {
        // People sign in now, so the session is worth keeping: without this every
        // reload would sign them out again. It lands in localStorage under
        // sb-<project-ref>-auth-token, which is why eraseAllData() in services/api.js
        // clears by prefix rather than from its key registry — the project ref is not
        // a literal anyone can write down in advance.
        persistSession: true,
        // An access token lasts an hour and someone may well be drawing for longer.
        autoRefreshToken: true,
        // Both the email confirmation link and the return leg of a Google sign-in
        // come back with a ?code= to exchange for a session. This is what spends it;
        // without it the person lands on the page still signed out.
        detectSessionInUrl: true,
      },
    });
    builtFrom = signature;
  }

  return client;
}
