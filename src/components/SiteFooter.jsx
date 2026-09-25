/* PLACER — the site footer */

import { Logo } from './UI';
import { Icon } from './Icon';
import { NEUTRAL } from '../theme';

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

// The footer is ink whatever the page is: white headings, grey-300 links that go
// white and underlined on hover, and grey-700 rules. No radius, no shadow.
const FOOTER_COLORS = {
  chrome: NEUTRAL.ink,
  ink: NEUTRAL.white,
  inkDim: NEUTRAL.grey300,
  inkFaint: NEUTRAL.grey500,
  line: NEUTRAL.grey700,
};

function FooterLink({ active, onClick, children }) {
  return (
    <span
      onClick={onClick}
      role="link"
      tabIndex={0}
      aria-current={active ? 'page' : undefined}
      className="placer-footer-link"
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}>
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
    <footer style={{ background: t.chrome, color: t.ink }}>
      <div className="placer-footer" style={{ maxWidth: 1440, margin: '0 auto' }}>
        <div className="placer-footer-grid">
          <div>
            <div onClick={() => onNavigate('welcome')} style={{ cursor: 'pointer', display: 'inline-block' }}>
              <Logo t={t} size={16} />
            </div>
            <p style={{ marginTop: 16, maxWidth: 360, fontSize: 14, lineHeight: '20px', color: t.inkDim }}>
              Reimagine your city. Sketch, share and vote on ideas for the streets and
              places around you.
            </p>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              {SOCIALS.map(({ icon, label, href }) => href ? (
                <a key={icon} href={href} target="_blank" rel="noopener noreferrer" aria-label={label}
                  className="placer-footer-link"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 44 }}>
                  <Icon name={icon} size={20} />
                </a>
              ) : (
                <span key={icon} aria-label={label} title={`${label} — coming soon`}
                  style={{ color: t.inkFaint, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 44 }}>
                  <Icon name={icon} size={20} />
                </span>
              ))}
            </div>
          </div>

          {COLUMNS.map(({ heading, links }) => (
            <div key={heading}>
              <div style={{ fontSize: 14, lineHeight: '20px', fontWeight: 700, marginBottom: 16 }}>
                {heading}
              </div>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12, fontSize: 14, lineHeight: '20px' }}>
                {links.map(({ label, view: target }) => (
                  <li key={label}>
                    {target ? (
                      <FooterLink active={view === target} onClick={() => onNavigate(target)}>{label}</FooterLink>
                    ) : (
                      <Placeholder t={t}>{label}</Placeholder>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="placer-footer-bottom" style={{ marginTop: 40, paddingTop: 24, borderTop: `1px solid ${t.line}`,
          fontSize: 12, lineHeight: '16px', letterSpacing: '0.01em' }}>
          <span style={{ color: t.inkDim }}>© 2026 PLACER. All rights reserved.</span>
          {/* Privacy and terms are one page for now, so both open it. */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24 }}>
            <FooterLink active={view === 'terms'} onClick={() => onNavigate('terms')}>Privacy Policy</FooterLink>
            <FooterLink active={view === 'terms'} onClick={() => onNavigate('terms')}>Terms of Service</FooterLink>
            <Placeholder t={t}>Security</Placeholder>
          </div>
        </div>
      </div>
    </footer>
  );
}
