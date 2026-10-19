/* PLACER — Site-Specific Spatial Mapping on a project's page.
 *
 * The room an organiser opened for the project, set into its public page rather than
 * behind a link: the tool itself, on the site they named and framed, with Record my
 * answers once the eighteen cards are done. The room is the project's (services/rooms'
 * readProjectOpenRooms); the answers are saved against it with this browser's
 * participant token, so recording again replaces the first — nobody is counted twice —
 * and what was recorded is remembered in this browser (toolkit/rooms' rememberAnswer),
 * so coming back carries on from it.
 *
 * Everybody else's answers are read as they are for the Desire Lines, and shown once
 * the visitor has recorded their own: a tally card, and See other answers.
 *
 * The service arrives as a prop, as in DesireLinesOnPage, so a test can hand this a fake.
 */

import { useEffect, useState } from 'react';
import { SiteMapping } from './SiteMapping';
import { answeredCount, combineSiteAnswers, recordedAnswers } from '../../lib/toolkit/siteMapping';
import { formatRoomDate, participantToken, rememberAnswer, rememberedAnswer } from '../../toolkit/rooms';
import * as roomService from '../../services/rooms';

// What this browser remembers may have been written by an earlier version of this page.
function remembered(roomId) {
  const saved = rememberedAnswer(roomId);
  if (!saved || typeof saved !== 'object' || !saved.answers) return null;
  const answers = recordedAnswers(saved);
  return answeredCount(answers.answers) > 0 ? answers : null;
}

export function SiteMappingOnPage({ t, tool, room, service = roomService }) {
  const [sent, setSent] = useState(() => remembered(room.id));
  const [status, setStatus] = useState('idle'); // 'idle' | 'sending' | 'closed' | 'error'
  const [others, setOthers] = useState(null);

  // Everyone's answers, kept live while the page is open.
  useEffect(() => {
    let cancelled = false;
    const refresh = () => service.readContributions(room.id)
      .then((contributions) => {
        if (!cancelled) setOthers(combineSiteAnswers(contributions.map((entry) => entry.state)));
      })
      .catch((err) => console.error('Could not read the site mapping answers:', err));
    refresh();
    const unsubscribe = service.subscribeToRoom(room.id, refresh);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [room.id, service]);

  const record = async (answers) => {
    setStatus('sending');
    try {
      const saved = await service.saveContribution({
        roomId: room.id, participantToken: participantToken(), displayName: null, state: answers,
      });
      if (!saved) {
        setStatus('closed');
        return;
      }
      rememberAnswer(room.id, answers);
      setSent(answers);
      setStatus('idle');
    } catch (err) {
      console.error('Could not record the answers:', err);
      setStatus('error');
    }
  };

  const closes = formatRoomDate(room.expiresAt);

  return (
    <div className="placer-card" style={{ padding: 24 }}>
      <SiteMapping t={t} tool={tool} room={room} recording={{ sent, status, others, onRecord: record }} />
      {closes && status !== 'closed' && (
        <p className="placer-caption" style={{ color: t.inkFaint, marginTop: 16 }}>Open until {closes}.</p>
      )}
    </div>
  );
}

export default SiteMappingOnPage;
