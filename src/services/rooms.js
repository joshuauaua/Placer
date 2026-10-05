/* PLACER — toolkit rooms, the network half.
 *
 * Five calls against Supabase. Four of them are RPCs rather than table queries,
 * because the rules in supabase/rooms.sql give the anon role no access to the
 * rooms table at all: creating, joining, closing and contributing are functions
 * that check what they are allowed to do on the way through. The one direct read
 * is the contributions of a room that is still open.
 *
 * Unlike everything else in services/, there is no localStorage fallback. A room
 * is shared between devices, and a room that exists only in one browser is not a
 * room — so with no project configured these throw, and the UI asks
 * isSupabaseConfigured() before it offers the feature at all.
 */

import { getSupabase, isSupabaseConfigured } from './supabase';

export const CONTRIBUTIONS_TABLE = 'toolkit_contributions';

export { isSupabaseConfigured };

async function client() {
  const supabase = await getSupabase();
  if (!supabase) {
    throw new Error(
      'Toolkit rooms need a Supabase project: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
    );
  }
  return supabase;
}

/**
 * Open a room on a tool.
 *
 * The PIN is chosen by the database, not here — it has to be unique, and only the
 * database can say so, and the same goes for the deadline: the browser's clock is
 * not to be trusted with when a room ends. Returns the facilitator token, which is
 * the one secret in this feature: whoever holds it can close the room early.
 *
 * Needs an account. toolkit_room_create is the one function in supabase/rooms.sql that
 * the anon role may not execute, so a signed-out caller is refused by Postgres rather
 * than by anything here — and what comes back is a message about function privileges,
 * which is true and no use to anybody. The Toolkit asks for a sign-in before it offers
 * the button; this is for the case where something got past that.
 *
 * `projectId` is optional and attaches the room to a project — see supabase/projects.sql
 * — so its dashboard and public page can show the session. Omitting it opens an
 * ordinary, unattached room exactly as this always has; passing one refuses unless the
 * caller owns or collaborates on that project, which the database checks, not this.
 *
 * `lifetime` is one of ROOM_LIFETIMES in toolkit/rooms.js. Anything past two hours
 * needs a project, and comes back with a `joinCode` for its QR code — see
 * supabase/rooms-lifetime.sql. The default is left off the request entirely, so a
 * workshop room still opens against a database that has not had that file yet.
 *
 * `config` is the tool's setup, for a tool that has one (`setup` in toolkit/tools.js),
 * fixed for the room's whole life — see supabase/rooms-config.sql. Left off the
 * request when there is none, for the same reason as the lifetime.
 */
export async function createRoom(toolId, projectId = null, lifetime = '2h', config = null) {
  const supabase = await client();
  const params = { p_tool: toolId, p_project_id: projectId };
  if (lifetime && lifetime !== '2h') params.p_lifetime = lifetime;
  if (config) params.p_config = config;

  const { data, error } = await supabase.rpc('toolkit_room_create', params).single();

  if (error) {
    // 42501 is insufficient_privilege, which PostgREST also reports as a 403.
    if (error.code === '42501' || /permission denied for function/i.test(error.message ?? '')) {
      throw new Error('Opening a room needs an account. Joining one does not.');
    }
    throw new Error(`Could not open a room: ${error.message}`);
  }

  return {
    id: data.room_id,
    pin: data.pin,
    joinCode: lifetime && lifetime !== '2h' ? (data.join_code ?? null) : null,
    facilitatorToken: data.facilitator_token,
    expiresAt: data.expires_at,
  };
}

/**
 * Look up a room by its PIN. Null for a PIN that is unknown, malformed, closed or
 * expired — they are all the same thing to somebody typing it in, and telling them
 * apart would only help somebody guessing.
 */
export async function joinRoom(pin) {
  const supabase = await client();
  const { data, error } = await supabase
    .rpc('toolkit_room_join', { p_pin: pin })
    .maybeSingle();

  if (error) throw new Error(`Could not join that room: ${error.message}`);
  if (!data) return null;

  return { id: data.room_id, tool: data.tool };
}

/**
 * Look up a room by the code in its QR link. Unlike a PIN this answers for a finished
 * room too — `status` is 'open', 'closed' or 'expired', and `endsAt` is when it ended
 * or will — so a poster scanned after its poll closed can say so. Null for a code
 * that matches nothing, including a room already swept away.
 */
export async function joinRoomByCode(code) {
  const supabase = await client();
  const { data, error } = await supabase
    .rpc('toolkit_room_join_code', { p_code: code })
    .maybeSingle();

  if (error) throw new Error(`Could not join that room: ${error.message}`);
  if (!data) return null;

  return { id: data.room_id, tool: data.tool, status: data.status, endsAt: data.expires_at };
}

/**
 * What a room is, given its id: which tool it belongs to, whether it is
 * 'open', 'closed' or 'expired', when it runs out, and how the tool was set up for
 * it (`config`, null when it was not). Null for a room that does not exist.
 *
 * A page reloaded on a room link has the id but not the PIN, and an empty open room
 * looks exactly like a finished one from the contributions alone — this is what
 * tells those apart. `expiresAt` comes from the database for the same reason the
 * PIN does: a countdown driven by the visitor's own clock would disagree with the
 * rules that actually end the room.
 */
export async function readRoom(roomId) {
  const supabase = await client();
  const { data, error } = await supabase
    .rpc('toolkit_room_state', { p_room_id: roomId })
    .maybeSingle();

  if (error) throw new Error(`Could not read the room: ${error.message}`);
  if (!data) return null;

  return { tool: data.tool, status: data.status, expiresAt: data.expires_at, config: data.config ?? null };
}

/**
 * Add or replace this participant's contribution. Resolves false when the room ended
 * underneath them — closed or run out of time — which is a normal thing to happen
 * rather than an error.
 */
export async function saveContribution({ roomId, participantToken, displayName, state }) {
  const supabase = await client();
  const { data, error } = await supabase.rpc('toolkit_contribution_save', {
    p_room_id: roomId,
    p_token: participantToken,
    p_name: displayName ?? null,
    p_state: state,
  });

  if (error) throw new Error(`Could not save your contribution: ${error.message}`);
  return data === true;
}

/** Everyone's contributions to an open room. Empty once the room is closed. */
export async function readContributions(roomId) {
  const supabase = await client();
  const { data, error } = await supabase
    .from(CONTRIBUTIONS_TABLE)
    .select('room_id, display_name, state, updated_at')
    .eq('room_id', roomId)
    .order('updated_at', { ascending: true });

  if (error) throw new Error(`Could not read the room: ${error.message}`);

  return (data ?? []).map((row) => ({
    displayName: row.display_name ?? null,
    state: row.state ?? {},
    updatedAt: row.updated_at ?? null,
  }));
}

/**
 * True once the room is closed. False if this browser was not the one that opened it,
 * and false for a room that had already run out of time — there was nothing to close.
 */
export async function closeRoom(roomId, facilitatorToken) {
  const supabase = await client();
  const { data, error } = await supabase.rpc('toolkit_room_close', {
    p_room_id: roomId,
    p_token: facilitatorToken,
  });

  if (error) throw new Error(`Could not close the room: ${error.message}`);
  return data === true;
}

/**
 * Delete a room and every contribution in it, open or ended. True once it is gone;
 * false if this token does not open it, or it was already gone. The facilitator's
 * token, the same one closing takes (supabase/rooms-delete.sql).
 */
export async function deleteRoom(roomId, facilitatorToken) {
  const supabase = await client();
  const { data, error } = await supabase.rpc('toolkit_room_delete', {
    p_room_id: roomId,
    p_token: facilitatorToken,
  });

  if (error) throw new Error(`Could not delete the room: ${error.message}`);
  return data === true;
}

/**
 * Call `onChange` whenever anything in this room changes.
 *
 * The payload is deliberately ignored. A change is only a nudge to re-read the
 * room through readContributions, so what arrives over the socket never has to be
 * trusted, and a missed message costs one stale render rather than a wrong total.
 *
 * Returns the unsubscribe function.
 */
export function subscribeToRoom(roomId, onChange) {
  // Stays synchronous even though the client now loads on demand: the caller uses
  // the returned function as a useEffect cleanup, and that cannot await. If the
  // room is left before the socket is up, `cancelled` stops it being opened at all.
  let cancelled = false;
  let teardown = null;

  (async () => {
    const supabase = await client();
    if (cancelled) return;

    const channel = supabase
      .channel(`toolkit-room-${roomId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: CONTRIBUTIONS_TABLE, filter: `room_id=eq.${roomId}` },
        () => onChange()
      )
      .subscribe();

    teardown = () => supabase.removeChannel(channel);
  })().catch(() => {
    // A room that cannot be followed is still a room: the totals were read once and
    // simply will not move on their own. Better than tearing the page down.
  });

  return () => {
    cancelled = true;
    if (teardown) teardown();
  };
}
