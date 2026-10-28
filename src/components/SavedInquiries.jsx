/* PLACER — the inquiries somebody has kept on their profile.
 *
 * Shown only to their owner, as a tab of their own profile (PublicProfilePage). Each is
 * a tool used on its own — a Desire Lines site, say, with the note on why it matters, or
 * an Idea Visualizer scene — kept to come back to or start a project's from later. So far
 * only Desire Lines offers them back: when setting it up for a project, its site is
 * offered from here (components/toolkit/DesireLinesSetup.jsx). Each tool says how its
 * own are summed up (`inquiry` in toolkit/tools.js). They can be deleted. Private to the
 * account (supabase/profile-inquiries.sql).
 *
 * The service arrives as a prop so a test can hand this a fake. `onCountChange` hears how
 * many there are once loaded and after each delete, for the count on the Activity tab.
 */

import { useEffect, useState } from 'react';
import { Btn } from './UI';
import { findTool } from '../toolkit/tools';
import * as inquiryService from '../services/inquiries';
import { mediaUrl } from '../services/media';

const FORMAT = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export function SavedInquiries({ t, service = inquiryService, onCountChange }) {
  const [state, setState] = useState({ status: 'loading', list: [] });

  useEffect(() => {
    if (state.status === 'ready') onCountChange?.(state.list.length);
  }, [state.status, state.list.length, onCountChange]);

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
        profile to come back to it or start a project from it later.
      </p>
    );
  }

  return (
    <ul aria-label="Saved inquiries" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
      {state.list.map((inquiry) => {
        const tool = findTool(inquiry.tool);
        const date = new Date(inquiry.createdAt ?? '');
        const picture = mediaUrl(tool?.inquiry?.picture?.(inquiry.config) ?? null);
        return (
          <li key={inquiry.id} style={{ padding: '18px 0', borderTop: `1px solid ${t.line}` }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: t.ink }}>{inquiry.title}</h3>
              <span className="placer-caption" style={{ color: t.inkDim }}>
                {[tool?.name ?? inquiry.tool, Number.isNaN(date.getTime()) ? null : FORMAT.format(date),
                  tool?.inquiry?.summary(inquiry.config)]
                  .filter(Boolean).join(' · ')}
              </span>
              <div style={{ flex: 1 }} />
              <Btn t={t} variant="ghost" size="sm" icon="trash" ariaLabel={`Delete ${inquiry.title}`}
                onClick={() => remove(inquiry)} />
            </div>
            {picture && (
              <img src={picture} alt="" loading="lazy"
                style={{ display: 'block', width: '100%', maxWidth: 360, marginTop: 10, borderRadius: 12,
                  border: `1px solid ${t.line}` }} />
            )}
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
        A Desire Lines inquiry can be chosen when you set up Desire Lines for a project, to start from its site.
      </li>
    </ul>
  );
}

export default SavedInquiries;
