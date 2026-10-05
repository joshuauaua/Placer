/* PLACER — the site footer */

import { Icon } from './Icon';
import { NEUTRAL } from '../theme';
import { BrandLogo } from './UI';

// Each column's entries. One with a `view` opens that MainApp view, one with an
// `href` opens outside the app, and one with neither is a placeholder for a page
// that does not exist yet — rendered as plain text so it cannot be mistaken for a
// link that goes nowhere. Exported because HamburgerMenu lists the same sections,
// so the menu and the footer cannot drift apart.
export const FOOTER_COLUMNS = [
  {
    heading: 'Project News',
    links: [
      { label: 'Project Announcement', href: 'https://www.stpln.se/participatory-toolkit' },
      {
        label: 'Pilot Project',
        href: 'https://si.se/en/projects-granted-funding/designing-participatory-spaces-innovation-in-placemaking-and-capacity-building/',
      },
      { label: 'User Labs', view: 'userLabs' },
    ],
  },
  {
    heading: 'Resources',
    links: [
      { label: 'Placemaking Trends Survey 2026/2027', view: 'placemakingTrendsSurvey' },
    ],
  },
  {
    heading: 'About Us',
    links: [
      { label: 'Who We Are', view: 'about' },
      // Unlike Development, this branch has a real Contact page (ContactPage.jsx).
      { label: 'Contact Us', view: 'contact' },
    ],
  },
];

const LICENSE_URL = 'https://www.gnu.org/licenses/agpl-3.0.html';
const SOURCE_URL = 'https://github.com/joshuauaua/Placer';

// The same address ContactPage.jsx shows.
const CONTACT_EMAIL = 'info@plcr.org';

// The footer is ink whatever the page is: white headings, grey-300 links that go
// white and underlined on hover, and grey-700 rules. No radius, no shadow.
const FOOTER_COLORS = {
  chrome: NEUTRAL.ink,
  ink: NEUTRAL.white,
  inkDim: NEUTRAL.grey300,
  inkFaint: NEUTRAL.grey500,
  line: NEUTRAL.grey700,
};

// Only Instagram and email are live so far.
const SOCIALS = [
  { icon: 'instagram', label: 'Instagram', href: 'https://www.instagram.com/placertool' },
  { icon: 'mail', label: 'Email', href: `mailto:${CONTACT_EMAIL}` },
];

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
            {/* The logo's black badge, its lettering at the footer's 16px cap height. */}
            <div onClick={() => onNavigate('welcome')} style={{ cursor: 'pointer', display: 'inline-block' }}>
              <BrandLogo variant="badge" height={56} label="PLACER" />
            </div>
            <p style={{ marginTop: 16, maxWidth: 360, fontSize: 14, lineHeight: '20px', color: t.inkDim }}>
              Reimagine your city. A toolkit for shaping shared spaces together.
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

          {FOOTER_COLUMNS.map(({ heading, links }) => (
            <div key={heading}>
              <div style={{ fontSize: 14, lineHeight: '20px', fontWeight: 700, marginBottom: 16 }}>
                {heading}
              </div>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12, fontSize: 14, lineHeight: '20px' }}>
                {links.map(({ label, view: target, href }) => (
                  <li key={label}>
                    {target ? (
                      <FooterLink active={view === target} onClick={() => onNavigate(target)}>{label}</FooterLink>
                    ) : href ? (
                      <a href={href} target="_blank" rel="noopener noreferrer"
                        className="placer-footer-link">{label}</a>
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
          {/* The AGPL asks that people using the site can get its source, so the
              repository is linked beside the licence. */}
          <span style={{ color: t.inkDim }}>
            Open source under the{' '}
            <a href={LICENSE_URL} target="_blank" rel="noopener noreferrer" className="placer-footer-link"
              style={{ textDecoration: 'underline' }}>
              AGPLv3 License
            </a>
            {' · '}
            <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer" className="placer-footer-link"
              style={{ textDecoration: 'underline' }}>
              Source code
            </a>
          </span>
          {/* Privacy and terms are one page for now, so both open it. */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24 }}>
            <FooterLink active={view === 'terms'} onClick={() => onNavigate('terms')}>Privacy Policy</FooterLink>
            <FooterLink active={view === 'terms'} onClick={() => onNavigate('terms')}>Terms of Service</FooterLink>
          </div>
        </div>
      </div>
    </footer>
  );
}
