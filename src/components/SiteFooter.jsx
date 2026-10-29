/* PLACER — the site footer */

import { useState } from 'react';
import { NEUTRAL } from '../theme';
import { saveSurveyResponse } from '../services/api';
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

// How the footer lays FOOTER_COLUMNS out beside its brand column on the left: one
// inner array per column, its sections stacked top to bottom. A section left out here
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

// Newsletter sign-ups land in survey_responses with only an email, under their
// own source, beside the surveys' own newsletter opt-ins.
const NEWSLETTER_SOURCE = 'newsletter_signup';

function NewsletterSignup({ t }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // idle | sending | done | error

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('sending');
    try {
      await saveSurveyResponse({ source: NEWSLETTER_SOURCE, email: email.trim() });
      setStatus('done');
    } catch {
      setStatus('error');
    }
  };

  if (status === 'done') {
    return (
      <p role="status" style={{ fontSize: 14, lineHeight: '20px', color: t.ink }}>
        Thanks — you're on the list.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* The heading, the field and the button on one line. */}
      <div className="placer-footer-newsletter">
        <label htmlFor="placer-footer-newsletter" className="placer-footer-heading"
          style={{ fontSize: 14, lineHeight: '20px', fontWeight: 700, whiteSpace: 'nowrap' }}>
          Follow our newsletter
        </label>
        <input id="placer-footer-newsletter" type="email" required autoComplete="email"
          placeholder="you@example.com" value={email}
          onChange={(e) => setEmail(e.target.value)} />
        <button type="submit" disabled={status === 'sending'}>
          {status === 'sending' ? 'Signing up…' : 'Sign up'}
        </button>
      </div>
      {status === 'error' && (
        <p role="alert" style={{ marginTop: 8, fontSize: 12, lineHeight: '16px', color: t.inkDim }}>
          That did not go through. Please try again.
        </p>
      )}
    </form>
  );
}

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
            {/* The logo in white (LOGO BB), at the footer's 16px cap height. */}
            <div onClick={() => onNavigate('welcome')} style={{ cursor: 'pointer', display: 'inline-block', color: t.ink }}>
              <BrandLogo height={16} label="PLACER" />
            </div>
            <p className="placer-footer-blurb" style={{ marginTop: 16, maxWidth: 360, fontSize: 14, lineHeight: '20px', color: t.inkDim }}>
              Reimagine your city. A toolkit for shaping shared spaces together.
            </p>

            {/* Who builds and funds it. The lockup reads "Funded by Swedish
                Institute" as part of the artwork; index.css turns it white. */}
            <p className="placer-footer-credit" style={{ marginTop: 24, maxWidth: 360, fontSize: 12, lineHeight: '18px', color: t.inkDim }}>
              PLACER is developed by{' '}
              <a href="https://stpln.se/" target="_blank" rel="noopener noreferrer" className="placer-footer-link"
                style={{ textDecoration: 'underline' }}>STPLN</a>{' '}
              and{' '}
              <a href="https://ankaraaks.com/" target="_blank" rel="noopener noreferrer" className="placer-footer-link"
                style={{ textDecoration: 'underline' }}>Ankara Aks</a>, funded by the Swedish Institute.
            </p>
            <img className="placer-footer-funder" src={logoSwedishInstitute} alt="Funded by Swedish Institute"
              style={{ marginTop: 16, height: 32, width: 'auto' }} />
          </div>

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

        {/* The newsletter, on its own line just above the rule. */}
        <div style={{ marginTop: 40 }}>
          <NewsletterSignup t={t} />
        </div>

        <div className="placer-footer-bottom" style={{ marginTop: 24, paddingTop: 24, borderTop: `1px solid ${t.line}`,
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
          <FooterLink active={view === 'terms'} onClick={() => onNavigate('terms')}>Privacy and Terms</FooterLink>
        </div>
      </div>
    </footer>
  );
}
