/* PLACER — the site footer */

import { Icon } from './Icon';
import { THEME_INK } from '../theme';

// Each column's entries. One with a `view` opens that MainApp view, one with an
// `href` opens outside the app, and one with neither is a placeholder for a page
// that does not exist yet — rendered as plain text so it cannot be mistaken for a
// link that goes nowhere. Exported because HamburgerMenu lists the same sections,
// so the menu and the footer cannot drift apart.
export const FOOTER_COLUMNS = [
  {
    heading: 'Project',
    links: [
      { label: 'Project Concept', href: 'https://www.stpln.se/participatory-toolkit' },
      { label: 'User Labs', view: 'userLabs' },
      {
        label: 'Swedish Institute',
        href: 'https://si.se/en/projects-granted-funding/designing-participatory-spaces-innovation-in-placemaking-and-capacity-building/',
      },
    ],
  },
  {
    heading: 'Resources',
    links: [
      { label: 'Placemaking Trends Survey 2026/2027', view: 'placemakingTrendsSurvey' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { label: 'About', view: 'about' },
      // Unlike Development, this branch has a real Contact page (ContactPage.jsx).
      { label: 'Contact Us', view: 'contact' },
    ],
  },
];

// The same address ContactPage.jsx shows.
const CONTACT_EMAIL = 'info@plcr.org';

// The footer is dark whatever the page is: black, with the night theme's light
// ink for its text, rules and icons.
const FOOTER_COLORS = {
  chrome: '#000000',
  ink: THEME_INK.ink,
  inkDim: THEME_INK.inkDim,
  inkFaint: THEME_INK.inkFaint,
  line: THEME_INK.line,
};

// Only Instagram and email are live so far.
const SOCIALS = [
  { icon: 'instagram', label: 'Instagram', href: 'https://www.instagram.com/placertool' },
  { icon: 'mail', label: 'Email', href: `mailto:${CONTACT_EMAIL}` },
];

function FooterLink({ t, active, onClick, children }) {
  return (
    <span
      onClick={onClick}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
      style={{ color: active ? t.ink : t.inkDim, cursor: 'pointer' }}>
      {children}
    </span>
  );
}

function Placeholder({ t, children }) {
  return <span style={{ color: t.inkFaint }}>{children}</span>;
}

/**
 * The footer under every MainApp view except the map. `view` is the one showing, so
 * its link can read as the current page; `onNavigate` is MainApp's `show`.
 */
export function SiteFooter({ t: pageTheme, view, onNavigate }) {
  const t = { ...pageTheme, ...FOOTER_COLORS };
  return (
    <footer style={{ background: t.chrome, borderTop: `1px solid ${t.line}`, color: t.ink }}>
      <div className="placer-footer" style={{ maxWidth: 1400, margin: '0 auto', padding: '48px 22px 28px' }}>
        <div className="placer-footer-grid">
          <div>
            {/* Wordmark only — no pin badge — the same choice Development's shared
                Logo makes, just kept local to the footer rather than changed for the
                nav bar too, which nobody asked to change. */}
            <span
              className="placer-disp"
              onClick={() => onNavigate('welcome')}
              style={{ cursor: 'pointer', display: 'inline-block', fontSize: 25.3, fontWeight: 800,
                letterSpacing: '-0.02em', color: t.ink }}>
              PLACER
            </span>
            <p style={{ marginTop: 16, maxWidth: 360, fontSize: 15, lineHeight: 1.55, color: t.inkDim }}>
              Reimagine your city. Sketch, share and vote on ideas for the streets and
              places around you.
            </p>
            <div style={{ display: 'flex', gap: 16, marginTop: 20 }}>
              {SOCIALS.map(({ icon, label, href }) => href ? (
                <a key={icon} href={href} target="_blank" rel="noopener noreferrer" aria-label={label}
                  style={{ color: t.inkDim }}>
                  <Icon name={icon} size={22} />
                </a>
              ) : (
                <span key={icon} aria-label={label} title={`${label} — coming soon`} style={{ color: t.inkFaint }}>
                  <Icon name={icon} size={22} />
                </span>
              ))}
            </div>
          </div>

          {FOOTER_COLUMNS.map(({ heading, links }) => (
            <div key={heading}>
              <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                marginBottom: 16 }}>
                {heading}
              </div>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12, fontSize: 15 }}>
                {links.map(({ label, view: target, href }) => (
                  <li key={label}>
                    {target ? (
                      <FooterLink t={t} active={view === target} onClick={() => onNavigate(target)}>{label}</FooterLink>
                    ) : href ? (
                      <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: t.inkDim }}>{label}</a>
                    ) : (
                      <Placeholder t={t}>{label}</Placeholder>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="placer-footer-bottom" style={{ marginTop: 40, paddingTop: 20, borderTop: `1px solid ${t.line}`,
          fontSize: 13 }}>
          <span style={{ color: t.inkFaint }}>© 2026 PLACER. All rights reserved.</span>
          {/* Privacy and terms are one page for now, so both open it. */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24 }}>
            <FooterLink t={t} active={view === 'terms'} onClick={() => onNavigate('terms')}>Privacy Policy</FooterLink>
            <FooterLink t={t} active={view === 'terms'} onClick={() => onNavigate('terms')}>Terms of Service</FooterLink>
          </div>
        </div>
      </div>
    </footer>
  );
}
