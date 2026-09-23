/* PLACER — the site footer */

import { Logo } from './UI';
import { Icon } from './Icon';
import { THEME_INK } from '../theme';

// Each column's entries. One with a `view` opens that MainApp view; one without is
// a placeholder for a page that does not exist yet, and renders as plain text so it
// cannot be mistaken for a link that goes nowhere.
const COLUMNS = [
  {
    heading: 'Product',
    links: [
      { label: 'Explore the map', view: 'map' },
      { label: 'Sandbox', view: 'sandbox' },
      { label: 'Projects' },
      { label: 'Pricing' },
    ],
  },
  {
    heading: 'Resources',
    links: [
      { label: 'Resources', view: 'resources' },
      { label: 'FAQs' },
      { label: 'Guides' },
      { label: 'Community' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { label: 'About', view: 'about' },
      { label: 'Contact Us' },
      { label: 'Careers' },
    ],
  },
];

// Only Instagram has an account behind it so far; the rest are placeholders.
const SOCIALS = [
  { icon: 'facebook', label: 'Facebook' },
  { icon: 'x', label: 'X' },
  { icon: 'instagram', label: 'Instagram', href: 'https://www.instagram.com/placertool' },
  { icon: 'linkedin', label: 'LinkedIn' },
];

// The footer is dark whatever the page is: black, with the night theme's light
// ink for its text, rules and icons.
const FOOTER_COLORS = {
  chrome: '#000000',
  ink: THEME_INK.ink,
  inkDim: THEME_INK.inkDim,
  inkFaint: THEME_INK.inkFaint,
  line: THEME_INK.line,
};

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
            <div onClick={() => onNavigate('welcome')} style={{ cursor: 'pointer', display: 'inline-block' }}>
              <Logo t={t} size={22} />
            </div>
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

          {COLUMNS.map(({ heading, links }) => (
            <div key={heading}>
              <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                marginBottom: 16 }}>
                {heading}
              </div>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12, fontSize: 15 }}>
                {links.map(({ label, view: target }) => (
                  <li key={label}>
                    {target ? (
                      <FooterLink t={t} active={view === target} onClick={() => onNavigate(target)}>{label}</FooterLink>
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
            <Placeholder t={t}>Security</Placeholder>
          </div>
        </div>
      </div>
    </footer>
  );
}
