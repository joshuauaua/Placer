/* PLACER — the header at the top of a signed-in page: a breadcrumb back to the
 * dashboard, the page's title under it, and any actions at the far end.
 *
 * It collapses as the page scrolls: the breadcrumb row sticks to the top of the
 * scrolling area, just under the nav bar, while the title, the actions and the
 * toolbar scroll away beneath it — and come back as the page returns to the top. That
 * is two siblings rather than one sticky box, so it needs no scroll handler to work
 * and nothing jumps: the row sticks within the page it sits in, which is why
 * PageHeader must be a direct child of the page's scrolling column. Once the row is
 * stuck it gains a rule along its foot (useStuck), on the page's own background so
 * what scrolls passes out of sight beneath it.
 *
 * The page is padded on either side; `inset` is that padding, which the header reaches
 * back out across so its background and rule run the page's full width. `maxWidth`
 * lines its text up with the page's column — 'none' for a page that runs edge to edge.
 *
 * `toolbar`, optional, is a row under the title — the Toolkit's filter, sort and view
 * controls.
 */

import { Fragment, useEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';

// Where every signed-in page's breadcrumb starts.
export const WORKSPACE_CRUMB = { label: 'My Workspace', href: '/dashboard' };

/**
 * "My Workspace / <page>", the way back to the dashboard from any page under it, or
 * any longer `trail` of { label, href } leading to `current` — a tool opened for a
 * project goes through the project, for one. Each step is a real link, for a new
 * tab, and stays in the app on a plain click.
 */
export function Breadcrumb({ t, current, trail = [WORKSPACE_CRUMB], style }) {
  const [, navigate] = useLocation();
  return (
    <nav aria-label="Breadcrumb" className="placer-mono"
      style={{ fontSize: 11.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: t.inkDim, ...style }}>
      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexWrap: 'wrap', gap: 7 }}>
        {trail.map(({ label, href }) => (
          <Fragment key={href}>
            <li>
              <a href={href} className="placer-breadcrumb-link"
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                  e.preventDefault();
                  navigate(href);
                }}>
                {label}
              </a>
            </li>
            <li aria-hidden="true">/</li>
          </Fragment>
        ))}
        <li aria-current="page" style={{ color: t.ink }}>{current}</li>
      </ol>
    </nav>
  );
}

/**
 * Whether `bar`, a sticky element right after `spacer`, is stuck: once the page has
 * scrolled, the spacer goes up with it and the bar does not, so a gap opens between
 * them. Read on every scroll (of whichever element scrolls — the capture catches it),
 * once a frame at most.
 */
function useStuck(spacerRef, barRef) {
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const spacer = spacerRef.current;
      const bar = barRef.current;
      if (!spacer || !bar) return;
      setStuck(bar.getBoundingClientRect().top - spacer.getBoundingClientRect().bottom > 0.5);
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(measure); };
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    measure();
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [spacerRef, barRef]);
  return stuck;
}

export function PageHeader({ t, title, actions, toolbar, inset = 40, maxWidth = 1200, style }) {
  const spacerRef = useRef(null);
  const barRef = useRef(null);
  const stuck = useStuck(spacerRef, barRef);
  const across = { marginLeft: -inset, marginRight: -inset, paddingLeft: inset, paddingRight: inset };

  return (
    <>
      <div ref={spacerRef} aria-hidden="true" style={{ height: 34 }} />
      <div ref={barRef} className="placer-page-header-bar"
        style={{ position: 'sticky', top: 0, zIndex: 10, ...across, paddingTop: 14, paddingBottom: 14,
          background: t.page, borderBottom: `1px solid ${stuck ? t.line : 'transparent'}` }}>
        <Breadcrumb t={t} current={title} style={{ maxWidth, margin: '0 auto' }} />
      </div>
      <header style={{ ...across, marginBottom: 32, paddingBottom: toolbar ? 12 : 24,
        background: t.page, borderBottom: `1px solid ${t.line}`, ...style }}>
        <div style={{ maxWidth, margin: '0 auto', display: 'flex', alignItems: 'flex-end',
          justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
          <h1 className="placer-disp" style={{ minWidth: 0, fontSize: 48, fontWeight: 700, color: t.ink,
            letterSpacing: '-0.03em', lineHeight: 1.05 }}>
            {title}
          </h1>
          {actions && <div style={{ display: 'flex', gap: 12, flex: '0 0 auto' }}>{actions}</div>}
        </div>
        {toolbar && <div style={{ maxWidth, margin: '24px auto 0' }}>{toolbar}</div>}
      </header>
    </>
  );
}
