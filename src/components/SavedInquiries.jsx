/* PLACER — the inquiries somebody has kept on their profile.
 *
 * Shown only to their owner, as a tab of their own profile (PublicProfilePage). Each is
 * a tool used on its own — a Desire Lines site, say, with the note on why it matters —
 * kept to start or join a project's from later: when setting that tool up for a project,
 * its site is offered from here (components/toolkit/DesireLinesSetup.jsx). They can be
 * deleted. Private to the account (supabase/profile-inquiries.sql).
 *
 * The service arrives as a prop so a test can hand this a fake.
 */

import { useEffect, useState } from 'react';
import { Btn } from './UI';
import { findTool } from '../toolkit/tools';
import * as inquiryService from '../services/inquiries';

const FORMAT = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

function summary(inquiry) {
  const walks = inquiry.config?.walks?.length ?? 0;
  const marks = inquiry.config?.site?.elements?.length ?? 0;
  return [
    walks > 0 && `${walks} ${walks === 1 ? 'walk' : 'walks'}`,
    marks > 0 && `${marks} ${marks === 1 ? 'mark' : 'marks'}`,
  ].filter(Boolean).join(' · ');
}

export function SavedInquiries({ t, service = inquiryService }) {
  const [state, setState] = useState({ status: 'loading', list: [] });

  useEffect(() => {
    let cancelled = false;
    service.readInquiries()
      .then((list) => { if (!cancelled) setState({ status: 'ready', list }); })
      .catch((err) => {
        console.error('Could not load your saved inquiries:', err);
        if (!cancelled) setState({ status: 'error', list: [] });
      });
    return () => { cancelled = true; };
  }, [service]);

  const remove = async (inquiry) => {
    try {
      await service.deleteInquiry(inquiry.id);
      setState((current) => ({ ...current, list: current.list.filter((other) => other.id !== inquiry.id) }));
    } catch (err) {
      console.error('Could not delete the inquiry:', err);
      setState((current) => ({ ...current, failed: inquiry.id }));
    }
  };

  if (state.status === 'loading') return <p style={{ fontSize: 15, color: t.inkDim }}>Loading your inquiries…</p>;
  if (state.status === 'error') {
    return <p role="alert" style={{ fontSize: 15, color: t.inkDim }}>Your saved inquiries could not be loaded.</p>;
  }
  if (state.list.length === 0) {
    return (
      <p style={{ fontSize: 15, color: t.inkDim, lineHeight: 1.6, maxWidth: 560 }}>
        Nothing kept yet. Use a tool from the Toolkit on its own, such as Desire Lines, and save it to your
        profile to start a project from it later.
      </p>
    );
  }

  return (
    <ul aria-label="Saved inquiries" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
      {state.list.map((inquiry) => {
        const tool = findTool(inquiry.tool);
        const date = new Date(inquiry.createdAt ?? '');
        return (
          <li key={inquiry.id} style={{ padding: '18px 0', borderTop: `1px solid ${t.line}` }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: t.ink }}>{inquiry.title}</h3>
              <span className="placer-caption" style={{ color: t.inkDim }}>
                {[tool?.name ?? inquiry.tool, Number.isNaN(date.getTime()) ? null : FORMAT.format(date), summary(inquiry)]
                  .filter(Boolean).join(' · ')}
              </span>
              <div style={{ flex: 1 }} />
              <Btn t={t} variant="ghost" size="sm" icon="trash" ariaLabel={`Delete ${inquiry.title}`}
                onClick={() => remove(inquiry)} />
            </div>
            {inquiry.note && (
              <p style={{ margin: '8px 0 0', fontSize: 15, lineHeight: 1.6, color: t.ink, whiteSpace: 'pre-line',
                overflowWrap: 'anywhere' }}>
                {inquiry.note}
              </p>
            )}
            {state.failed === inquiry.id && (
              <p role="alert" style={{ margin: '8px 0 0', fontSize: 13.5, color: t.ink }}>It could not be deleted.</p>
            )}
          </li>
        );
      })}
      <li style={{ borderTop: `1px solid ${t.line}`, paddingTop: 14, fontSize: 13.5, color: t.inkDim }}>
        Choose one when you set up Desire Lines for a project, to start from its site.
      </li>
    </ul>
  );
}

export default SavedInquiries;
