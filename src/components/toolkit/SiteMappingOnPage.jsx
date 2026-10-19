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
 * On the page it is a cover: a panel in the tool's colour, with the section's heading
 * on it and a Start the survey button, which opens the tool in a dialog over the page.
 * The answers are kept here, not in the dialog, so closing it part-way and opening it
 * again carries on. `heading` is the section's { id, title } (the page draws no
 * heading of its own for this tool: onProjectPage.cover).
 *
 * The service arrives as a prop, as in DesireLinesOnPage, so a test can hand this a fake.
 */

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SiteMapping } from './SiteMapping';
import { Btn } from '../UI';
import { Icon } from '../Icon';
import {
  answeredCount, combineSiteAnswers, recordedAnswers, siteFromConfig,
} from '../../lib/toolkit/siteMapping';
import { formatRoomDate, participantToken, rememberAnswer, rememberedAnswer } from '../../toolkit/rooms';
import * as roomService from '../../services/rooms';

// What this browser remembers may have been written by an earlier version of this page.
function remembered(roomId) {
  const saved = rememberedAnswer(roomId);
  if (!saved || typeof saved !== 'object' || !saved.answers) return null;
  const answers = recordedAnswers(saved);
  return answeredCount(answers.answers) > 0 ? answers : null;
}

/** The tool over the page, until it is closed: with its button, Escape or a click outside. */
function SurveyDialog({ t, title, onClose, children }) {
  const panelRef = useRef(null);

  useEffect(() => {
    const opener = document.activeElement;
    panelRef.current?.focus();
    const handleKeyDown = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKeyDown);
    // The page behind stays where it was rather than scrolling under the dialog.
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = overflow;
      opener?.focus?.();
    };
  }, [onClose]);

  return createPortal(
    <div onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 180, background: 'rgba(0, 0, 0, 0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}
        style={{ position: 'relative', width: '100%', maxWidth: 960, maxHeight: 'calc(100vh - 32px)',
          overflowY: 'auto', padding: '56px 24px 24px', background: t.surface, borderRadius: 16,
          boxShadow: t.shadow, outline: 'none' }}>
        <button type="button" onClick={onClose} aria-label="Close the survey"
          style={{ position: 'absolute', top: 12, right: 12, width: 40, height: 40, borderRadius: 999,
            border: `1px solid ${t.line}`, background: t.surface, color: t.ink, cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="close" size={18} stroke={2.2} />
        </button>
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function SiteMappingOnPage({ t, tool, room, heading = null, service = roomService }) {
  const [open, setOpen] = useState(false);
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
  const site = siteFromConfig(room.config);
  const title = heading?.title ?? tool.onProjectPage?.heading ?? tool.name;
  // The tool's own colour, the 700 of its palette colour (blue), under white.
  const colour = tool.color;

  return (
    <>
      <div className="placer-site-cover" style={{ background: colour }}>
        <span className="placer-site-cover-mark" aria-hidden="true">
          <Icon name={tool.icon} size={240} stroke={1.1} />
        </span>
        <div className="placer-site-cover-body">
          <h2 id={heading?.id} className="placer-h2" style={{ color: '#fff', margin: 0 }}>{title}</h2>
          {site && <p style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: 15, margin: 0 }}>{site.name}</p>}
          <Btn t={t} variant="outline" size="lg" icon="arrowRight" onClick={() => setOpen(true)}
            style={{ marginTop: 8, borderColor: '#fff' }}>
            {sent ? 'See your answers' : 'Start the survey'}
          </Btn>
        </div>
      </div>
      {closes && status !== 'closed' && (
        <p className="placer-caption" style={{ color: t.inkFaint, marginTop: 12 }}>Open until {closes}.</p>
      )}

      {open && (
        <SurveyDialog t={t} title={title} onClose={() => setOpen(false)}>
          <SiteMapping t={t} tool={tool} room={room} recording={{ sent, status, others, onRecord: record }} />
        </SurveyDialog>
      )}
    </>
  );
}

export default SiteMappingOnPage;
