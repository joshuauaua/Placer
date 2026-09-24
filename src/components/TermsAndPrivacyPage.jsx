/* PLACER — Terms and Privacy (Terms of Service, Privacy Policy and GDPR rights,
 * combined onto one page rather than split across three). */

import { useState } from 'react';
import { LegalPage, Chapter, Section, P, Bullets, Callout, Table, ExternalLink } from './LegalLayout';
import { Btn } from './UI';
import { OPERATOR, GOVERNING_LAW, GOOGLE_PRIVACY_URL, POSTHOG_PRIVACY_URL, EDPB_AUTHORITIES_URL } from '../legal';
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
      link.download = 'placer-data-export.json';
      link.click();
      posthog.capture('data_exported');
      setStatus('Your data has been downloaded as placer-data-export.json.');
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
      setStatus('Everything PLACER stored in this browser has been deleted.');
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
        Because PLACER keeps your work in your own browser rather than on a server, you can act
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
        PLACER asks before it turns on PostHog analytics, and you can change that answer here at
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

export function TermsAndPrivacyPage({ t }) {
  return (
    <LegalPage
      t={t}
      title="Terms and Privacy"
      intro="The rules for using PLACER, how it handles your information, and your rights under the GDPR — in one place instead of three."
    >
      <Chapter t={t} title="Terms of Service" />

      <Callout t={t} icon="check" title="The short version">
        Use PLACER like a decent neighbour: nothing illegal, nothing meant to break the map or
        the tool for anyone else. PLACER has no accounts and keeps your work in your own
        browser, so there is nothing to sign up for. The only things of yours we hold are the
        survey answers and User Lab applications you choose to send us.
      </Callout>

      <Section t={t} title="Agreement to these terms">
        <P t={t}>
          These terms govern your use of PLACER, the web application operated by {OPERATOR.name}.
          By opening PLACER, exploring the map, building on the canvas, answering a survey or
          applying for a User Lab, you agree to them. If you do not agree, do not use PLACER.
        </P>
        <P t={t}>
          The Privacy Policy and GDPR sections below are part of these terms, not a separate
          document — they describe what PLACER does with information, which is itself something
          you are agreeing to by using it.
        </P>
      </Section>

      <Section t={t} title="Who can use PLACER">
        <P t={t}>
          PLACER is intended for general community use. It is not directed at children under 13,
          and by using it you confirm you are 13 or older. See Children, under the Privacy Policy
          below, for how this is handled in practice.
        </P>
      </Section>

      <Section t={t} title="Acceptable use">
        <P t={t}>
          You agree not to, and not to help anyone else:
        </P>
        <Bullets t={t} items={[
          'Build or share anything illegal, infringing, defamatory or harassing using PLACER.',
          'Scrape, mine or bulk-download the map, its assets or survey data.',
          'Probe, disable or bypass PLACER’s security or rate limits.',
          'Interfere with the map, Street View integration, or another visitor’s ability to use them.',
          'Automate requests to PLACER or to the third-party services it relies on.',
        ]} />
        <P t={t}>
          We can restrict access for anyone who breaks these rules.
        </P>
      </Section>

      <Section t={t} title="Content you create">
        <P t={t}>
          Ideas you build in PLACER are yours. Since PLACER stores them only in your own
          browser rather than on our server, we hold no copy and claim no rights over them. You
          are responsible for what you build, and for not using PLACER to create or store anything
          illegal or infringing.
        </P>
      </Section>

      <Section t={t} title="Third-party services">
        <P t={t}>
          PLACER shows map tiles and Street View imagery from Google Maps Platform, subject to
          Google&rsquo;s own terms, sends usage analytics to PostHog, if you accept them,
          subject to PostHog&rsquo;s own terms, and stores survey answers and User Lab
          applications with Supabase, our database provider. We are not responsible for the
          availability, accuracy or content of any of them.
        </P>
      </Section>

      <Section t={t} title="Disclaimers">
        <P t={t}>
          PLACER is provided &ldquo;as is&rdquo;, without warranty of any kind. It is a tool for
          sketching a proposal for a public space, not professional planning, engineering or
          legal advice, and nothing on PLACER should be treated as such. We do not guarantee
          PLACER, or the third-party map and imagery services it relies on, will be available,
          uninterrupted, or free of errors.
        </P>
      </Section>

      <Section t={t} title="Limitation of liability">
        <P t={t}>
          To the extent the law allows, {OPERATOR.name} is not liable for indirect, incidental or
          consequential damages arising from your use of PLACER. Nothing in these terms limits
          liability that cannot lawfully be limited.
        </P>
      </Section>

      <Section t={t} title="Termination">
        <P t={t}>
          You can stop using PLACER at any time — there is no account to close, and clearing your
          browser&rsquo;s site data removes everything PLACER has stored in your browser. We can restrict access
          for anyone who breaks these terms.
        </P>
      </Section>

      <Section t={t} title="Governing law">
        <P t={t}>
          These terms are governed by the laws of {GOVERNING_LAW}, without regard to its conflict
          of law principles.
        </P>
      </Section>

      <Section t={t} title="Changes to these terms">
        <P t={t}>
          If we change these terms in a way that meaningfully affects your rights, we will update
          the date at the top of this page and, where the change is significant, announce it in
          the app. Continuing to use PLACER after a change takes effect means you accept it.
        </P>
      </Section>

      <Chapter t={t} title="Privacy Policy" />

      <Callout t={t} icon="check" title="The short version">
        PLACER has no user accounts. The ideas you build stay in your own browser, on the device
        you built them on. Three things do leave your device: the map and Street View imagery
        requests PLACER makes to Google on your behalf; the survey answers and User Lab
        applications you choose to send us, which we store; and &mdash; only if you accept the
        cookie banner &mdash; usage analytics sent to PostHog. Reject it and nothing is measured.
      </Callout>

      <Section t={t} title="Who this policy applies to">
        <P t={t}>
          This policy covers the PLACER web application, operated by {OPERATOR.name}. It applies
          to everyone who uses PLACER, whether or not you save anything.
        </P>
      </Section>

      <Section t={t} title="Information PLACER holds">
        <P t={t}>
          <strong style={{ color: t.ink }}>Ideas you create.</strong> When you save an
          imagination, PLACER stores the location you chose, the assets you placed and their
          positions, any title or description you wrote, plus comments and upvotes. This is
          written to your browser&rsquo;s local storage, under keys beginning{' '}
          <code className="placer-mono" style={{ fontSize: 13, color: t.ink }}>placemaking_</code>.
          It is not uploaded to a server.
        </P>
        <P t={t}>
          <strong style={{ color: t.ink }}>Survey answers.</strong> When you submit a survey, your
          answers are sent to our database, hosted by Supabase. They are anonymous unless you add
          contact details, which are always optional: the short survey asks for an email address
          only if you want to follow the project, and the Placemaking Trends survey can take your
          name, work email, municipality and department, and whether you would like beta access or
          an invitation to a User Lab.
        </P>
        <P t={t}>
          <strong style={{ color: t.ink }}>User Lab applications.</strong> When you apply for a User
          Lab, we store which lab you chose, your name, email address, phone number if you give
          one, what you do, what you hope to get out of the session, any food allergies or dietary
          preferences you tell us, and whether you would like our newsletter. We use it to select
          participants, organise the lab and contact you about it, and we only send you the
          newsletter if you ticked the box for it.
        </P>
        <P t={t}>
          <strong style={{ color: t.ink }}>Food allergies and dietary preferences.</strong> These
          can reveal information about your health, so we treat them with extra care. They are
          optional, used only to cater for you at the session, and deleted after it.
        </P>
        <P t={t}>
          <strong style={{ color: t.ink }}>Imagery you work with.</strong> Street View frames
          are analysed in your browser to detect the lines and surfaces of the scene. The
          image processing runs locally on your device; the frames are not sent to us.
        </P>
        <P t={t}>
          <strong style={{ color: t.ink }}>Usage analytics, if you accept them.</strong> PLACER can
          send usage data to PostHog, an analytics provider, to see how the app is actually used
          and where it breaks. That covers the features you open, the events PLACER emits (such as
          posting an imagination), a recording of your session in the app, errors it hits, and the
          device, browser and IP-derived approximate location behind them. It is off until you
          accept: PLACER does not contact PostHog at all &mdash; no request, no cookie, no
          recording &mdash; until you do, and rejecting the banner keeps it that way. Analytics
          are never linked to a name or email address you give us in a survey or application.
        </P>
        <P t={t}>
          You can change that answer whenever you like, and see what is currently set, in the
          analytics controls further down this page, under GDPR.{' '}
          <ExternalLink t={t} href={POSTHOG_PRIVACY_URL}>Read PostHog&rsquo;s privacy policy</ExternalLink>
        </P>
        <P t={t}>
          <strong style={{ color: t.ink }}>What PLACER does not collect.</strong>
        </P>
        <Bullets t={t} items={[
          'No account or password — there is nothing to sign up for. We only have your name or contact details if you give them to us in a survey or a User Lab application.',
          'No advertising, no ad cookies, no data sold or shared with brokers.',
          'No analytics at all unless you accept them, and none for anyone who rejects.',
          'No record of the places you look at or the ideas you build — those never leave your browser.',
        ]} />
      </Section>

      <Section t={t} title="Google Maps and Street View">
        <P t={t}>
          PLACER loads map tiles and Street View imagery directly from Google Maps Platform. To
          serve those images, Google receives the coordinates you are viewing, your IP address
          and standard request details such as your browser and operating system. That
          processing is governed by Google&rsquo;s own privacy policy, not this one.
        </P>
        <P t={t}>
          <ExternalLink t={t} href={GOOGLE_PRIVACY_URL}>Read Google&rsquo;s privacy policy</ExternalLink>
        </P>
      </Section>

      <Section t={t} title="Where survey answers and applications are stored">
        <P t={t}>
          Survey answers and User Lab applications are stored in a database hosted by Supabase
          in the EU (Ireland), which processes them on our behalf under its data processing
          agreement. Your browser can
          send an answer or application to it but cannot read anything back: only the PLACER team
          can see what has been submitted.
        </P>
      </Section>

      <Section t={t} title="How long it is kept">
        <P t={t}>
          Saved ideas stay in your browser until you delete them or clear your browsing data
          for this site — PLACER sets no expiry. Because storage is per-browser and per-device,
          your work does not follow you to another computer, and anyone else using the same
          browser profile can see it.
        </P>
        <P t={t}>
          User Lab applications are deleted within 12 months of the lab they were for, and food
          allergies and dietary preferences are deleted once the session has taken place. Survey
          answers are kept for the research and the Placemaking Trends 2026/2027 Report; contact
          details given with them are deleted within 12 months of the report&rsquo;s publication.
          A newsletter sign-up lasts until you unsubscribe. You can ask us to delete any of these
          sooner.
        </P>
        <P t={t}>
          Analytics you have consented to are held for as long as our PostHog project is
          configured to keep them, and withdrawing consent stops anything further being collected.
        </P>
      </Section>

      <Section t={t} title="Your choices">
        <Bullets t={t} items={[
          'Accept or reject analytics on the banner, and change that answer later further down this page, under GDPR.',
          'Leave out the optional contact details in the surveys and the phone number and food fields in the User Lab form.',
          'Ask us to see, correct or delete a survey answer or User Lab application, or to take you off the newsletter, by emailing us.',
          'Delete a single idea from the dashboard where it is listed.',
          'Download everything PLACER holds on this device, or erase all of it at once, further down this page, under GDPR.',
          'Clear site data in your browser settings to remove everything PLACER has stored, including the seeded asset library.',
          'Use a private or incognito window if you would rather nothing persisted at all.',
        ]} />
        <P t={t}>
          If you are in the EU or UK, the GDPR section below sets out your legal rights and how
          to exercise them.
        </P>
      </Section>

      <Section t={t} title="Children">
        <P t={t}>
          PLACER is intended for general community use and is not directed at children under 13.
          We do not knowingly collect information from them, and the surveys and User Lab
          applications are meant for adults.
        </P>
      </Section>

      <Section t={t} title="Changes to this policy">
        <P t={t}>
          If PLACER starts storing ideas on a server, adds accounts, or sends data anywhere it does
          not already, this policy will be updated before that happens and the date at the top of
          the page will change. Anything that would widen what we collect will be asked for, not
          assumed. Significant changes will be announced in the app.
        </P>
      </Section>

      <Chapter t={t} title="GDPR" />

      <Callout t={t} icon="check" title="Where your data actually sits">
        The ideas you make stay with you: assets, comments and upvotes are written to your
        browser&rsquo;s local storage, not to a PLACER server, so most of what follows is something
        you can do yourself in a couple of clicks rather than a request you have to send us. The
        exceptions are the survey answers and User Lab applications you choose to send us, which
        we hold and you can ask us about, and usage analytics, which go to PostHog &mdash; and
        only if you accept them.
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
              'Survey answers, and any contact details you add (name, email, municipality, department, opt-ins)',
              'Research on citizen engagement in public space, the Placemaking Trends 2026/2027 Report, and contacting you if you asked us to',
              'Consent (Art. 6(1)(a)) — you choose to submit; contact details are optional',
              'Answers for the research; contact details deleted within 12 months of the report’s publication, or on request',
            ],
            [
              'User Lab applications: the lab you chose, name, email, phone (optional), what you do and why you are interested',
              'Selecting participants, organising the User Lab and contacting you about it',
              'Consent (Art. 6(1)(a)) — you choose to apply',
              'Deleted within 12 months of the lab, or on request',
            ],
            [
              'Food allergies or dietary preferences (optional, in a User Lab application)',
              'Catering for you at the session',
              'Explicit consent (Art. 9(2)(a)) — you choose to tell us',
              'Deleted after the session',
            ],
            [
              'Newsletter sign-up (the email address on your application)',
              'Sending you PLACER news and the newsletter',
              'Consent (Art. 6(1)(a)) — only if you tick the box; withdrawable at any time',
              'Until you unsubscribe',
            ],
            [
              'Usage analytics sent to PostHog: the features you use, the events PLACER emits (for example posting an imagination), a session recording of your visit, error reports, and the device, browser and IP-derived approximate location behind them',
              'Understanding how PLACER is used, and finding the parts of it that break',
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
          The only special category data PLACER may process is the food allergies you choose to
          give in a User Lab application, which can reveal health information; it is optional,
          used only for catering and deleted after the session. PLACER makes no automated
          decisions about you within the meaning of Article 22. Analytics are used in aggregate:
          PostHog gives your browser an anonymous identifier so that repeat visits can be counted,
          but PLACER never links it to a name or email address you give us.
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
          For survey answers and User Lab applications, tell us the email address you used and we
          will find them. The ideas you build are different: they stay in your browser and we
          hold no copy, so we have no way to look them up on our side &mdash; which is also why
          we cannot restore anything you erase.
        </P>
      </Section>

      <Section t={t} title="International transfers">
        <P t={t}>
          Requests for map and Street View imagery go to Google, which processes them outside the
          EEA, including in the United States, relying on Standard Contractual Clauses and the EU-US
          Data Privacy Framework.
        </P>
        <P t={t}>
          Survey answers and User Lab applications are stored with Supabase in the EU (Ireland).
          Supabase, Inc. is a US company, so any support access from outside the EEA is covered
          by the Standard Contractual Clauses in its data processing agreement.
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
          PLACER runs no advertising scripts and sets no cookies of its own. Two kinds of browser
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
          'Data minimisation — no accounts and no passwords. Contact details are asked for only where we need to reach you, and are optional in the surveys. The only identifier PLACER sets is the anonymous one PostHog assigns, and only once you have accepted analytics.',
          'Consent before capture — the analytics SDK is not even loaded until consent exists, so a visitor who rejects the banner, or never answers it, is never contacted or measured.',
          'Storage limitation — your ideas are never retained centrally, and survey answers and applications are deleted on the schedule above.',
          'Write-only submissions — the browser can send a survey answer or application to our database but cannot read any back.',
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

      <Section t={t} title="Contact">
        <P t={t}>
          Questions about these terms, this policy, or your data can go to{' '}
          <ExternalLink t={t} href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</ExternalLink>,
          or by post to {OPERATOR.name}, {OPERATOR.address}.
        </P>
      </Section>
    </LegalPage>
  );
}

export default TermsAndPrivacyPage;
