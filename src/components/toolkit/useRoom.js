/* PLACER — the room a toolkit tool is being played in, if it is in one.
 *
 * Everything below the Toolkit page only renders what this returns, so the room's
 * lifecycle lives in one place and can be tested without a DOM — the same
 * arrangement as survey/useSurveyForm.js.
 *
 * The service functions arrive as props rather than being imported, so a test can
 * hand this a fake instead of mocking a module. `status` is the whole story:
 *
 *   'none'    — not in a room, and the tool may or may not be able to host one
 *   'opening' — creating a room, or loading one from a link
 *   'open'    — in a room; `contributions` and `combined` are live
 *   'closed'  — its facilitator ended it early
 *   'deleted' — its facilitator deleted it, and everything contributed to it
 *   'expired' — it ran out of time; a room lasts two hours from being opened, or
 *               longer when a project opens it for weeks (supabase/rooms-lifetime.sql)
 *   'error'   — `error` says what went wrong, in a sentence fit to show somebody
 *
 * The deadline always comes from the database. The browser's clock is used only to
 * decide when to stop believing it, so a page left open past the deadline says the
 * room is over rather than sitting there looking live.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_LIFETIME,
  forgetHostedRoom,
  hostedRoom,
  participantToken,
  rememberHostedRoom,
} from '../../toolkit/rooms';
import * as roomService from '../../services/rooms';

/** How long to sit on a change before publishing it. A slider fires far too often. */
const PUBLISH_DELAY = 500;

/**
 * The longest delay setTimeout honours. Anything past it — about 24.8 days — fires
 * straight away, which for a room opened for a month would mean calling it over the
 * moment it opened. Longer waits are taken in steps of this.
 */
const MAX_TIMER_DELAY = 2 ** 31 - 1;

export function useRoom({ tool, roomId, displayName, onOpened, projectId = null, service = roomService }) {
  const capable = Boolean(tool?.room) && service.isSupabaseConfigured();

  const [status, setStatus] = useState('none');
  const [error, setError] = useState(null);
  const [pin, setPin] = useState(null);
  const [joinCode, setJoinCode] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [contributions, setContributions] = useState([]);
  const [expiresAt, setExpiresAt] = useState(null);

  // Kept in refs so the debounced publish and the unmount cleanup can see the
  // current values without re-arming their effects on every keystroke.
  const timerRef = useRef(null);
  const pendingRef = useRef(null);
  const nameRef = useRef(displayName);
  nameRef.current = displayName;

  const refresh = useCallback(
    async (id) => {
      try {
        setContributions(await service.readContributions(id));
      } catch {
        // A failed refresh leaves the last good totals on screen. The room is not
        // broken just because one read was, and the next change will try again.
      }
    },
    [service]
  );

  // Load a room named in the URL, and follow it for as long as we are in it.
  useEffect(() => {
    if (!roomId || !capable) {
      setStatus('none');
      setContributions([]);
      setIsHost(false);
      setPin(null);
      setJoinCode(null);
      setExpiresAt(null);
      return undefined;
    }

    let live = true;
    let unsubscribe = null;

    setStatus('opening');
    setError(null);

    (async () => {
      try {
        const room = await service.readRoom(roomId);
        if (!live) return;

        if (!room) {
          setError('That room does not exist. It may already have been closed.');
          setStatus('error');
          return;
        }
        if (room.tool !== tool.id) {
          setError('That room belongs to a different tool.');
          setStatus('error');
          return;
        }

        const hosted = hostedRoom(roomId);
        setIsHost(Boolean(hosted));
        setPin(hosted?.pin ?? null);
        setJoinCode(hosted?.code ?? null);
        setExpiresAt(room.expiresAt ?? null);

        if (room.status !== 'open') {
          // 'closed' or 'expired' — the copy differs, so the distinction is kept.
          setStatus(room.status);
          setContributions([]);
          return;
        }

        setStatus('open');
        await refresh(roomId);
        if (!live) return;

        unsubscribe = service.subscribeToRoom(roomId, () => refresh(roomId));
      } catch (cause) {
        if (!live) return;
        setError(cause.message);
        setStatus('error');
      }
    })();

    return () => {
      live = false;
      if (unsubscribe) unsubscribe();
    };
  }, [roomId, capable, tool?.id, refresh, service]);

  // Nothing half-published should outlive the component.
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  // Sitting on an open room until its deadline. Without this the page would go on
  // offering a PIN that has already stopped working. `recheck` re-arms the timer when
  // a deadline is further off than one setTimeout can wait.
  const [recheck, setRecheck] = useState(0);
  useEffect(() => {
    if (status !== 'open' || !expiresAt) return undefined;

    const left = new Date(expiresAt).getTime() - Date.now();
    if (left <= 0) {
      setStatus('expired');
      return undefined;
    }

    const timer = left > MAX_TIMER_DELAY
      ? setTimeout(() => setRecheck((n) => n + 1), MAX_TIMER_DELAY)
      : setTimeout(() => setStatus('expired'), left);
    return () => clearTimeout(timer);
  }, [status, expiresAt, recheck]);

  /**
   * Open a room on this tool and hand its id back to the caller to navigate to.
   * `lifetime` is one of ROOM_LIFETIMES; anything past two hours needs `projectId`,
   * which the database enforces.
   */
  const start = useCallback(async (lifetime) => {
    setStatus('opening');
    setError(null);
    try {
      const room = await service.createRoom(tool.id, projectId, lifetime ?? DEFAULT_LIFETIME);
      rememberHostedRoom(room.id, { pin: room.pin, token: room.facilitatorToken, code: room.joinCode ?? null });
      setPin(room.pin);
      setJoinCode(room.joinCode ?? null);
      setIsHost(true);
      setExpiresAt(room.expiresAt ?? null);
      if (onOpened) onOpened(room.id);
      return room;
    } catch (cause) {
      setError(cause.message);
      setStatus('error');
      return null;
    }
  }, [tool?.id, onOpened, projectId, service]);

  /**
   * Publish this browser's state, no more than once every PUBLISH_DELAY. The last
   * value wins: a slider dragged across its range is one contribution, not forty.
   */
  const publish = useCallback(
    (state) => {
      if (status !== 'open' || !roomId) return;
      pendingRef.current = state;

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(async () => {
        timerRef.current = null;
        const payload = pendingRef.current;
        try {
          const saved = await service.saveContribution({
            roomId,
            participantToken: participantToken(),
            displayName: nameRef.current,
            state: payload,
          });
          if (!saved) {
            // The room ended while somebody was still moving a slider. Which of the
            // two endings it was decides what they are told, so it is read rather
            // than assumed.
            const room = await service.readRoom(roomId).catch(() => null);
            setStatus(room?.status === 'closed' ? 'closed' : 'expired');
          }
        } catch (cause) {
          setError(cause.message);
        }
      }, PUBLISH_DELAY);
    },
    [roomId, status, service]
  );

  /** Close the room. Only the browser that opened it holds the token to do so. */
  const close = useCallback(async () => {
    const hosted = hostedRoom(roomId);
    if (!hosted) return false;

    try {
      const closed = await service.closeRoom(roomId, hosted.token);
      if (closed) {
        forgetHostedRoom(roomId);
        setStatus('closed');
        setContributions([]);
      }
      return closed;
    } catch (cause) {
      setError(cause.message);
      return false;
    }
  }, [roomId, service]);

  /** Delete the room and what it held. The same token, and the same browser, as close. */
  const remove = useCallback(async () => {
    const hosted = hostedRoom(roomId);
    if (!hosted) return false;

    try {
      const deleted = await service.deleteRoom(roomId, hosted.token);
      if (deleted) {
        forgetHostedRoom(roomId);
        setStatus('deleted');
        setContributions([]);
      }
      return deleted;
    } catch (cause) {
      setError(cause.message);
      return false;
    }
  }, [roomId, service]);

  const combined = useMemo(() => {
    if (!tool?.room || contributions.length === 0) return null;
    return tool.room.combine(contributions.map((entry) => entry.state));
  }, [contributions, tool]);

  return {
    capable,
    status,
    error,
    roomId: roomId ?? null,
    pin,
    joinCode,
    expiresAt,
    isHost,
    contributions,
    participantCount: contributions.length,
    combined,
    start,
    publish,
    close,
    remove,
  };
}

export default useRoom;
