/* PLACER — keeping a tool used on its own on the signed-in account's profile.
 *
 * Every tool run outside a room offers this: what has been made so far, kept as an
 * inquiry (services/inquiries.js, supabase/profile-inquiries.sql) to come back to or
 * start a project's from later. The tool says what that is — `inquiry`, a { title,
 * note, config } or null while there is nothing worth keeping yet — and `intro` says
 * in a sentence what will be kept.
 *
 * Changing anything after keeping it makes it something else to keep, so the button
 * comes back. Signed out, it says why there is nothing to press; with no Supabase
 * project there are no accounts at all, and it shows nothing.
 */

import { useState } from 'react';
import { useLocation } from 'wouter';
import { Panel } from '../ToolLayout';
import { Btn } from '../UI';
import { useIdentity } from '../useIdentity';
import { saveInquiry } from '../../services/inquiries';

/** Whether a tool is being used on its own, rather than in a room or for a project. */
export function onItsOwn(room) {
  return !room || room.status === 'none';
}

export function KeepOnProfile({ t, tool, inquiry, intro }) {
  const { status, accountId } = useIdentity();
  const [, navigate] = useLocation();
  const [saving, setSaving] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'error'
  const [savedAs, setSavedAs] = useState(null);
  const snapshot = inquiry ? JSON.stringify(inquiry) : null;
  const current = saving === 'saved' && savedAs !== snapshot ? 'idle' : saving;

  if (status === 'local' || status === 'loading') return null;

  if (status === 'signedOut') {
    return (
      <p style={{ margin: 0, fontSize: 13.5, color: t.inkDim, lineHeight: 1.6 }}>
        Sign in to keep this on your profile and come back to it later.
      </p>
    );
  }

  const keep = async () => {
    setSaving('saving');
    try {
      await saveInquiry({ tool, ...inquiry });
      setSavedAs(snapshot);
      setSaving('saved');
    } catch (err) {
      console.error('Could not keep the inquiry:', err);
      setSaving('error');
    }
  };

  return (
    <Panel t={t} title="Keep it">
      <p style={{ margin: '0 0 12px', fontSize: 13.5, color: t.inkDim, lineHeight: 1.6 }}>{intro}</p>
      <Btn t={t} variant="primary" size="sm" icon="bookmark"
        disabled={!inquiry || current === 'saving' || current === 'saved'} onClick={keep}>
        {current === 'saving' ? 'Saving…' : current === 'saved' ? 'Saved to your profile' : 'Save to my profile'}
      </Btn>
      {current === 'saved' && accountId && (
        <p role="status" style={{ margin: '12px 0 0', fontSize: 13.5, color: t.ink }}>
          <a href={`/people/${accountId}`} onClick={(event) => { event.preventDefault(); navigate(`/people/${accountId}`); }}
            style={{ color: t.ink, fontWeight: 700 }}>
            See your saved inquiries
          </a>
        </p>
      )}
      {current === 'error' && (
        <p role="alert" style={{ margin: '12px 0 0', fontSize: 13.5, color: t.ink }}>It did not save. Please try again.</p>
      )}
    </Panel>
  );
}

export default KeepOnProfile;
