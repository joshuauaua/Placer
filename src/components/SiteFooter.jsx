/* PLACER — the site footer */

import { NEUTRAL } from '../theme';
import { BrandLogo } from './UI';
import logoSwedishInstitute from '../assets/logo-swedish-institute.png';

// Each column's entries. One with a `view` opens that MainApp view, one with an
// `href` opens outside the app, and one with neither is a placeholder for a page
// that does not exist yet — rendered as plain text so it cannot be mistaken for a
// link that goes nowhere. Exported because HamburgerMenu lists the same sections,
// so the menu and the footer cannot drift apart.
export const FOOTER_COLUMNS = [
  {
    heading: 'Project News',
    links: [
      { label: 'User Labs', view: 'userLabs' },
      { label: 'Placemaking Trends Survey 2026/2027', view: 'placemakingTrendsSurvey' },
      { label: 'Project Announcement', href: 'https://www.stpln.se/participatory-toolkit' },
      {
        label: 'Pilot Project',
        href: 'https://si.se/en/projects-granted-funding/designing-participatory-spaces-innovation-in-placemaking-and-capacity-building/',
      },
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

// How the footer lays FOOTER_COLUMNS out, from the left: one inner array per column, its sections stacked top to bottom. A section left out here
// is not shown, so a new one has to be placed.
const FOOTER_LAYOUT = [
  ['Project News'],
  ['About Us'],
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

// Only Instagram and email are live so far. Listed under About Us, after its links,
// in the footer only: the menu has no use for them.
const SOCIALS_UNDER = 'About Us';
const SOCIALS = [
  { label: 'Instagram', href: 'https://www.instagram.com/placertool' },
  { label: 'Email', href: `mailto:${CONTACT_EMAIL}` },
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
          {FOOTER_LAYOUT.map((headings) => (
            <div key={headings.join()} style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
              {headings.map((heading) => FOOTER_COLUMNS.find((column) => column.heading === heading))
                .filter(Boolean)
                .map(({ heading, links }) => (
                  <div key={heading}>
                    <div className="placer-footer-heading" style={{ fontSize: 14, lineHeight: '20px', fontWeight: 700, marginBottom: 16 }}>
                      {heading}
                    </div>
                    <ul className="placer-footer-links" style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12, fontSize: 14, lineHeight: '20px' }}>
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
                      {heading === SOCIALS_UNDER && SOCIALS.map(({ label, href }) => (
                        <li key={label}>
                          <a href={href} target="_blank" rel="noopener noreferrer" className="placer-footer-link">
                            {label} ↗
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
            </div>
          ))}

        </div>

        <div className="placer-footer-bottom" style={{ marginTop: 48, paddingTop: 24, borderTop: `1px solid ${t.line}`,
          fontSize: 12, lineHeight: '16px', letterSpacing: '0.01em' }}>
          {/* The AGPL asks that people using the site can get its source, so the
              repository is linked beside the licence. Under it, the logo in
              white (LOGO BB), at the footer's 16px cap height. */}
          <div className="placer-footer-signoff">
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
              {' · '}
              <FooterLink active={view === 'terms'} onClick={() => onNavigate('terms')}>Privacy and Terms</FooterLink>
            </span>
            <div onClick={() => onNavigate('welcome')} style={{ cursor: 'pointer', display: 'inline-block', color: t.ink }}>
              <BrandLogo height={16} label="PLACER" />
            </div>
          </div>

          {/* Who builds and funds it, on one line at the right. The lockup reads
              "Funded by Swedish Institute" as part of the artwork; index.css
              turns it white. */}
          <div className="placer-footer-credit">
            <span style={{ color: t.inkDim }}>
              PLACER is developed by{' '}
              <a href="https://stpln.se/" target="_blank" rel="noopener noreferrer" className="placer-footer-link"
                style={{ textDecoration: 'underline' }}>STPLN</a>{' '}
              and{' '}
              <a href="https://ankaraaks.com/" target="_blank" rel="noopener noreferrer" className="placer-footer-link"
                style={{ textDecoration: 'underline' }}>Ankara Aks</a>, funded by the Swedish Institute.
            </span>
            <img className="placer-footer-funder" src={logoSwedishInstitute} alt="Funded by Swedish Institute"
              style={{ height: 32, width: 'auto' }} />
          </div>
        </div>
      </div>
    </footer>
  );
}
