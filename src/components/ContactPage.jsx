/* PLACER — Contact Page
 *
 * Not a form: the project has no backend to receive one, so the page just
 * points visitors at the same inbox the footer links to.
 */

import { Section, P, ExternalLink } from './LegalLayout';

const CONTACT_EMAIL = 'info@plcr.org';

export function ContactPage({ t }) {
  return (
    <div style={{
      width: '100%',
      height: '100%',
      overflowY: 'auto',
      background: t.page,
      padding: '48px 40px 96px'
    }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <div style={{ marginBottom: 40, paddingBottom: 32, borderBottom: `1px solid ${t.line}` }}>
          <h1 className="placer-disp" style={{
            fontSize: 48,
            fontWeight: 700,
            color: t.ink,
            letterSpacing: '-0.03em',
            marginBottom: 16,
            lineHeight: 1.1
          }}>
            Contact
          </h1>
          <p style={{ fontSize: 18, color: t.inkDim, lineHeight: 1.6 }}>
            Questions, feedback, or want to get involved? We&rsquo;d like to hear from you.
          </p>
        </div>

        <Section t={t} title="Email">
          <P t={t}>
            Reach the PLACER team at{' '}
            <ExternalLink t={t} href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</ExternalLink>.
          </P>
        </Section>

        <Section t={t} title="The team behind PLACER">
          <P t={t}>
            PLACER is developed by <ExternalLink t={t} href="https://stpln.se/">STPLN</ExternalLink>{' '}
            and <ExternalLink t={t} href="https://ankaraaks.com/">Ankara Aks</ExternalLink>, funded
            by the Swedish Institute.
          </P>
        </Section>
      </div>
    </div>
  );
}

export default ContactPage;
