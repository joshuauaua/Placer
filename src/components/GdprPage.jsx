/* PLOT — GDPR / data rights */

import { useState } from 'react';
import { LegalPage, Section, P, Bullets, Callout, Table, ExternalLink, PageLink } from './LegalLayout';
import { Btn } from './UI';
import { OPERATOR, GOOGLE_PRIVACY_URL, POSTHOG_PRIVACY_URL, EDPB_AUTHORITIES_URL } from '../legal';
import { exportAllData, eraseAllData } from '../services/api';
import { readConsent, grantConsent, denyConsent, GRANTED, DENIED } from '../analytics';
import posthog from 'posthog-js';

const RIGHTS = [
  ['Access (Art. 15)', 'Get a copy of the personal data held about you, and be told what it is used for.'],
  ['Rectification (Art. 16)', 'Have inaccurate data corrected and incomplete data completed.'],
  ['Erasure (Art. 17)', 'Have your data deleted where there is no overriding reason to keep it.'],
  ['Restriction (Art. 18)', 'Ask that processing be paused while a dispute about your data is resolved.'],
  ['Portability (Art. 20)', 'Receive your data in a structured, machine-readable format and reuse it elsewhere.'],
  ['Objection (Art. 21)', 'Object to processing based on legitimate interests.'],
  ['Withdraw consent (Art. 7)', 'Withdraw consent at any time, without affecting processing that already happened.'],
  ['Complain (Art. 77)', 'Lodge a complaint with your national supervisory authority.'],
];

function DataControls({ t }) {
  const [busy, setBusy] = useState(null);
  const [status, setStatus] = useState(null);
  const [confirmErase, setConfirmErase] = useState(false);

  const handleExport = async () => {
    setBusy('export');
    setStatus(null);
    try {
      const { dataUri } = await exportAllData();
      const link = document.createElement('a');
      link.href = dataUri;
      link.download = 'plot-data-export.json';
      link.click();
      posthog.capture('data_exported');
      setStatus('Your data has been downloaded as plot-data-export.json.');
    } catch {
      setStatus('The export could not be created. Your browser may be blocking local storage.');
    } finally {
      setBusy(null);
    }
  };

  const handleErase = async () => {
    if (!confirmErase) {
      setStatus('This permanently deletes every idea saved in this browser. Press Erase again to confirm.');
      setConfirmErase(true);
      return;
    }
    setBusy('erase');
    try {
      await eraseAllData();
      posthog.capture('data_erased');
      setStatus('Everything PLOT stored in this browser has been deleted.');
    } catch {
      setStatus('The data could not be erased. Try clearing site data in your browser settings.');
    } finally {
      setBusy(null);
      setConfirmErase(false);
    }
  };

  return (
    <div style={{
      padding: 28,
      background: t.surface,
      borderRadius: 12,
      border: `1px solid ${t.line}`,
      boxShadow: t.shadow,
      marginBottom: 40
    }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: t.ink, marginBottom: 8 }}>
        Exercise your rights on this device
      </div>
      <P t={t} style={{ fontSize: 15, marginBottom: 20 }}>
        Because PLOT keeps your work in your own browser rather than on a server, you can act
        on access, portability and erasure yourself, immediately — no request needed.
      </P>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Btn t={t} variant="primary" icon="share" onClick={handleExport} disabled={busy === 'export'}>
          {busy === 'export' ? 'Preparing…' : 'Download my data'}
        </Btn>
        <Btn t={t} variant="outline" icon="trash" onClick={handleErase} disabled={busy === 'erase'}>
          {confirmErase ? 'Erase — confirm' : 'Erase my data'}
        </Btn>
      </div>
      {status && (
        <div style={{ fontSize: 14, color: t.inkDim, lineHeight: 1.6, marginTop: 16 }}>
          {status}
        </div>
      )}
    </div>
  );
}

// Article 7(3): consent has to be as easy to withdraw as it was to give. The
// banner is shown once; this is where the choice can be changed afterwards.
function ConsentControls({ t }) {
  const [decision, setDecision] = useState(() => readConsent());

  const choose = (record, next) => () => {
    record();
    setDecision(next);
  };

  const state = decision === GRANTED
    ? 'Analytics are on for this browser. PostHog is receiving events, session recordings and error reports.'
    : decision === DENIED
      ? 'Analytics are off. PostHog captures nothing and stores nothing in this browser.'
      : 'No choice recorded yet. Analytics are off until you accept.';

  return (
    <div style={{
      padding: 28,
      background: t.surface,
      borderRadius: 12,
      border: `1px solid ${t.line}`,
      boxShadow: t.shadow,
      marginBottom: 40
    }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: t.ink, marginBottom: 8 }}>
        Analytics consent
      </div>
      <P t={t} style={{ fontSize: 15, marginBottom: 20 }}>
        PLOT asks before it turns on PostHog analytics, and you can change that answer here at
        any time. Withdrawing consent stops capture immediately; it does not undo events already
        collected, though you can ask us to delete those using the contact address above.
      </P>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Btn t={t} variant="primary" icon="check" onClick={choose(grantConsent, GRANTED)}
          disabled={decision === GRANTED}>
          Accept analytics
        </Btn>
        <Btn t={t} variant="outline" icon="close" onClick={choose(denyConsent, DENIED)}
          disabled={decision === DENIED}>
          Reject analytics
        </Btn>
      </div>
      <div style={{ fontSize: 14, color: t.inkDim, lineHeight: 1.6, marginTop: 16 }}>
        {state}
      </div>
    </div>
  );
}

export function GdprPage({ t, onNavigate }) {
  return (
    <LegalPage
      t={t}
      title="GDPR"
      intro="Your rights under the EU General Data Protection Regulation and the UK GDPR, and how PLOT meets them."
    >
      <Callout t={t} icon="check" title="Where your data actually sits">
        The ideas you make stay with you: assets, comments and upvotes are written to your
        browser&rsquo;s local storage, not to a PLOT server, so most of what follows is something
        you can do yourself in a couple of clicks rather than a request you have to send us. The
        one exception is usage analytics, which go to PostHog &mdash; and only if you accept them.
      </Callout>

      <Section t={t} title="Data controller">
        <P t={t}>
          {OPERATOR.name}, {OPERATOR.address}, is the controller for the limited processing
          described here. Data protection enquiries:{' '}
          <ExternalLink t={t} href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</ExternalLink>.
        </P>
      </Section>

      <Section t={t} title="What is processed, and why">
        <Table
          t={t}
          columns={['Data', 'Purpose', 'Legal basis', 'Retention']}
          rows={[
            [
              'Ideas you save (location, placed assets, text, comments, upvotes)',
              'Letting you build, revisit and share a proposal for a public space',
              'Consent (Art. 6(1)(a)) — you choose to save; stored only on your device',
              'Until you delete it or clear site data',
            ],
            [
              'Survey answers',
              'Understanding what communities want from public space',
              'Consent (Art. 6(1)(a))',
              'Held in the page only; discarded on close or reload',
            ],
            [
              'Usage analytics sent to PostHog: the features you use, the events PLOT emits (for example posting an imagination), a session recording of your visit, error reports, and the device, browser and IP-derived approximate location behind them',
              'Understanding how PLOT is used, and finding the parts of it that break',
              'Consent (Art. 6(1)(a)) — off unless you accept, withdrawable at any time',
              'As configured in our PostHog project; nothing at all before you accept',
            ],
            [
              'IP address and request metadata sent to Google Maps Platform',
              'Fetching the map tiles and Street View imagery you asked to see',
              'Legitimate interests (Art. 6(1)(f)) — delivering the feature you requested',
              'Set by Google, not by us',
            ],
          ]}
        />
        <P t={t}>
          PLOT does not process special category data and makes no automated decisions about you
          within the meaning of Article 22. Analytics are used in aggregate: PostHog gives your
          browser an anonymous identifier so that repeat visits can be counted, but PLOT never
          links it to a name, an email address or an account, because it holds none.
        </P>
      </Section>

      <Section t={t} title="Your rights">
        <Table t={t} columns={['Right', 'What it means']} rows={RIGHTS} />
      </Section>

      <DataControls t={t} />

      <ConsentControls t={t} />

      <Section t={t} title="Making a request to us">
        <P t={t}>
          For anything the controls above cannot cover, email{' '}
          <ExternalLink t={t} href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</ExternalLink>.
          We respond within one month, as Article 12(3) requires, and will tell you if we need
          to extend that by up to two further months for a complex request. There is no charge.
        </P>
        <P t={t}>
          One practical limit worth stating plainly: since PLOT holds no account or identifier
          for you, we usually have no way to look up &ldquo;your&rdquo; data on our side — which
          is also why we cannot restore anything you erase.
        </P>
      </Section>

      <Section t={t} title="International transfers">
        <P t={t}>
          Requests for map and Street View imagery go to Google, which processes them outside the
          EEA, including in the United States, relying on Standard Contractual Clauses and the EU-US
          Data Privacy Framework.
        </P>
        <P t={t}>
          Analytics, if you accept them, go to PostHog&rsquo;s EU Cloud and are stored in the EU.
          PostHog Inc. is a US company, so any support access from outside the EEA is covered by
          the Standard Contractual Clauses in its data processing agreement.
        </P>
        <P t={t}>
          <ExternalLink t={t} href={GOOGLE_PRIVACY_URL}>Google&rsquo;s privacy policy</ExternalLink>
          {' · '}
          <ExternalLink t={t} href={POSTHOG_PRIVACY_URL}>PostHog&rsquo;s privacy policy</ExternalLink>
        </P>
      </Section>

      <Section t={t} title="Cookies and similar technologies">
        <P t={t}>
          PLOT runs no advertising scripts and sets no cookies of its own. Two kinds of browser
          storage are in play:
        </P>
        <Bullets t={t} items={[
          'Strictly necessary — your saved ideas, and the record of your analytics choice, are kept in local storage. This is what makes the feature you asked for work, and needs no consent.',
          'Analytics — PostHog sets a cookie and local storage entries to recognise your browser across visits, and records your session. PostHog is not loaded at all until you accept: no request leaves your browser, nothing is written and nothing is recorded, and rejecting keeps it that way. The analytics controls above change your answer.',
        ]} />
        <P t={t}>
          Google may also set cookies of its own when serving map and Street View imagery.
        </P>
      </Section>

      <Section t={t} title="Data protection by design">
        <Bullets t={t} items={[
          'Data minimisation — no accounts, no email addresses, no passwords. The only persistent identifier is the anonymous one PostHog assigns, and only once you have accepted analytics.',
          'Consent before capture — the analytics SDK is not even loaded until consent exists, so a visitor who rejects the banner, or never answers it, is never contacted or measured.',
          'Storage limitation — your ideas are never retained centrally, so there is no store of them to breach.',
          'Local processing — Street View frames are analysed in your browser, not uploaded.',
          'Transparency — every third party that receives data is named on this page.',
        ]} />
      </Section>

      <Section t={t} title="Complaints">
        <P t={t}>
          If you are unhappy with how we have handled your data, you can complain to the
          supervisory authority in the EU or EEA country where you live or work, or to the
          Information Commissioner&rsquo;s Office in the UK. You do not have to contact us first,
          though it usually resolves things faster.
        </P>
        <P t={t}>
          <ExternalLink t={t} href={EDPB_AUTHORITIES_URL}>Find your supervisory authority</ExternalLink>
        </P>
      </Section>

      <Section t={t} title="Related">
        <P t={t}>
          The{' '}
          <PageLink t={t} onClick={() => onNavigate('privacy')}>Privacy Policy</PageLink>{' '}
          describes in plain language what PLOT does with information.
        </P>
      </Section>
    </LegalPage>
  );
}

export default GdprPage;
