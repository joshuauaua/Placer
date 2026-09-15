/* PLACER — GDPR / data rights */

import { useState } from 'react';
import { LegalPage, Section, P, Bullets, Callout, Table, ExternalLink, PageLink } from './LegalLayout';
import { Btn } from './UI';
import {
  OPERATOR,
  GOOGLE_PRIVACY_URL,
  POSTHOG_PRIVACY_URL,
  SUPABASE_PRIVACY_URL,
  EDPB_AUTHORITIES_URL,
} from '../legal';
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
      setStatus(
        'This permanently deletes everything PLACER has saved in this browser, including work '
        + 'you have not posted. It reaches nothing held on our server: not your account or '
        + 'profile, not the imaginations you have posted, and it does not reach survey answers '
        + 'you have already submitted — the section below says how to reach those. '
        + 'Press Erase again to confirm.'
      );
      setConfirmErase(true);
      return;
    }
    setBusy('erase');
    try {
      await eraseAllData();
      posthog.capture('data_erased');
      setStatus(
        'Everything PLACER stored in this browser has been deleted. Your account, your profile, '
        + 'anything you posted and any survey answers already submitted are unaffected; delete a '
        + 'posted imagination from your profile, and email us for the rest.'
      );
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
        These two buttons cover what is stored in this browser — unposted work, comments, your
        analytics choice — and you can act on it yourself, immediately, with no request to us.
        They do not reach our server. An imagination you have posted you delete from your profile,
        which removes its picture too; your account, your profile and any survey answers you have
        submitted need a request, and the section below says how to make one.
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

export function GdprPage({ t, onNavigate }) {
  return (
    <LegalPage
      t={t}
      title="GDPR"
      intro="Your rights under the EU General Data Protection Regulation and the UK GDPR, and how PLACER meets them."
    >
      <Callout t={t} icon="check" title="Where your data actually sits">
        Two places, and the line between them is the Post button. Until you press it, your work is
        in your browser&rsquo;s local storage and you can export or erase it yourself in a couple of
        clicks. Once you post, the imagination and its picture are on our server and on a public
        map: readable by anyone, changeable and deletable only by you. Your account and profile
        live there too, as do survey answers you submit and Sandbox rooms you join. Usage
        analytics go to PostHog, and only if you accept them.
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
              'Account credentials — your email address, a hash of your password, whether the address is confirmed, and the link to your Google identity if you sign in that way',
              'Letting you have an account, so that what you post is yours and only you can change it',
              'Contract (Art. 6(1)(b)) — an account is what posting to a shared map requires',
              'Until you ask us to delete the account',
            ],
            [
              'Profile — your display name, which is public, and a bio if you write one',
              'Crediting an imagination to somebody, so a map of proposals has authors rather than anonymous pins',
              'Contract (Art. 6(1)(b)) — part of having an account. The name need not be your real one',
              'Until you change it, or the account is deleted. A name already copied onto a posted imagination stays as it was',
            ],
            [
              'Imaginations you post — location and coordinates, the assets you placed, title, category, description, upvote count, timestamps, your account id and your display name at the time',
              'Publishing a proposal for a public space on a map the community can read',
              'Consent (Art. 6(1)(a)) — you choose to post, and posting is publishing. Anyone can read it; only you can change or delete it',
              'Until you delete it, or delete your account, which deletes everything posted under it',
            ],
            [
              'The preview picture of a posted imagination — your scene composited onto the Street View frame, stored under a folder named after your account',
              'Showing the imagination on the map and on its own page',
              'Consent (Art. 6(1)(a)) — uploaded when you post. It is served from a public web address that needs no account to open, and search engines may reach it',
              'Deleted when the imagination is deleted, or with the account',
            ],
            [
              'Work you have not posted — an imagination in progress, comments, the asset library, your analytics choice, and your sign-in session token',
              'Letting you build, revisit and revise before deciding whether to publish',
              'Consent (Art. 6(1)(a)) for what you save; the session token is strictly necessary to keep you signed in',
              'Stored in your browser only, until you delete it or clear site data. Never uploaded unless you post it',
            ],
            [
              'Survey answers — the options you choose, and anything you type into a free-text field',
              'Understanding how community engagement works today, and deciding what to build next',
              'Consent (Art. 6(1)(a)) — you choose to submit, and can stop at any point before you do',
              'Kept while this research runs. Answers submitted without an email address carry no identifier and are analysed in aggregate',
            ],
            [
              'Your email address, if you choose to give one on the last step of the survey',
              'Replying to you about the closed beta, and about anything you offered to help with',
              'Consent (Art. 6(1)(a)) — optional, and only asked for when you have said you want to be involved further',
              'Until you ask us to remove it, or the closed beta programme ends',
            ],
            [
              'Sandbox room contributions — what you allocate in a shared Sandbox experiment, and the name your browser is set to display, if any',
              'Letting a roomful of people work through the same experiment together and see the result combined',
              'Consent (Art. 6(1)(a)) — you choose to join a room, and only what you allocate is sent',
              'Two hours from the room being opened, or sooner if the facilitator closes it. After that it cannot be reached at all, and it is deleted within a day',
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
          PLACER does not process special category data and makes no automated decisions about you
          within the meaning of Article 22. Analytics are used in aggregate: PostHog gives your
          browser an anonymous identifier so that repeat visits can be counted, and PLACER never
          joins that identifier to your account, to a survey answer or to an email address.
        </P>
        <P t={t}>
          Posting is publication, so it is worth being blunt about what that means. An imagination
          you post is readable by anyone who opens the map, signed in or not, together with the
          display name you posted it under; its picture is readable by anyone who has the address
          it is served from, with no sign-in at all. So put nothing in a title, description or
          scene that you would not put on a public website, and choose a display name you are
          content to publish.
        </P>
        <P t={t}>
          One thing worth knowing before you type: the survey&rsquo;s free-text fields are stored as
          you write them, so please leave out names, addresses and anything else you would not want
          kept. Everything else in the survey is a fixed choice from a list.
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
          <strong style={{ color: t.ink }}>Deleting your account.</strong> There is no button for
          this yet, so email us and we will do it. It removes the login, the profile, every
          imagination posted under the account and every picture belonging to those imaginations.
          It cannot be undone, and an imagination somebody has already seen or screenshotted is
          beyond anyone&rsquo;s reach — deletion stops us serving it, which is all deletion can ever do.
        </P>
        <P t={t}>
          <strong style={{ color: t.ink }}>How we identify you.</strong> If you have an account,
          write from its email address and we can find everything held against it. If you gave an
          address in the survey, that is what we look those answers up by. If you submitted the
          survey without an address, the answers carry nothing that identifies you and we genuinely
          cannot pick them out of the others — which is the point of collecting them that way, but
          it does mean there is nothing for us to act on. Nothing you erase in your browser can be
          restored either.
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
          Everything we store — accounts and profiles, the imaginations you post, the pictures of
          them, survey answers and Sandbox rooms — is held in a Postgres database and file storage
          hosted by Supabase in the EU, acting as our processor. Supabase Inc. is a US company, so
          support access from outside the EEA is likewise covered by the Standard Contractual
          Clauses in its data processing agreement. The pictures are served from a public address
          on that storage, which means they may be fetched from wherever the person looking at the
          map happens to be.
        </P>
        <P t={t}>
          <ExternalLink t={t} href={GOOGLE_PRIVACY_URL}>Google&rsquo;s privacy policy</ExternalLink>
          {' · '}
          <ExternalLink t={t} href={POSTHOG_PRIVACY_URL}>PostHog&rsquo;s privacy policy</ExternalLink>
          {' · '}
          <ExternalLink t={t} href={SUPABASE_PRIVACY_URL}>Supabase&rsquo;s privacy policy</ExternalLink>
        </P>
      </Section>

      <Section t={t} title="Cookies and similar technologies">
        <P t={t}>
          PLACER runs no advertising scripts and sets no cookies of its own. Two kinds of browser
          storage are in play:
        </P>
        <Bullets t={t} items={[
          'Strictly necessary — your unposted work, the record of your analytics choice, and, once you sign in, the session token that keeps you signed in across reloads, are kept in local storage. This is what makes the feature you asked for work, and needs no consent.',
          'Analytics — PostHog sets a cookie and local storage entries to recognise your browser across visits, and records your session. PostHog is not loaded at all until you accept: no request leaves your browser, nothing is written and nothing is recorded, and rejecting keeps it that way. The analytics controls above change your answer.',
        ]} />
        <P t={t}>
          Google may also set cookies of its own when serving map and Street View imagery.
          Submitting the survey sets nothing. Signing out clears the session token; the Erase
          button above clears PLACER&rsquo;s own keys and leaves you signed in, so use both if you want
          the browser left with neither. Joining a Sandbox room stores two random identifiers in
          local storage — one so that editing your answer revises it rather than adding a second,
          one so that a room you opened is a room you can close. Neither is tied to you, both are
          covered by the export and erasure controls above, and neither is a sign-in.
        </P>
      </Section>

      <Section t={t} title="Data protection by design">
        <Bullets t={t} items={[
          'Data minimisation — an account needs an email address and nothing else: no real name, no phone number, no date of birth. Reading the map, building on the canvas, answering the survey and joining a room all work with no account at all. The survey asks for an address only when you have said you want to be involved beyond it.',
          'Nothing uploaded by default — the upload happens when you press Post, and until then the work is on your device. Imaginations saved before accounts existed are left there rather than migrated, because they were saved under a policy that promised they would not leave.',
          'Ownership enforced in the database — row-level security, not app code, is what makes a posted imagination readable by everyone and writable only by the account that posted it. A stolen or inspected browser key cannot change or delete somebody else’s work.',
          'Consent before capture — the analytics SDK is not even loaded until consent exists, so a visitor who rejects the banner, or never answers it, is never contacted or measured.',
          'Storage limitation — deleting an imagination deletes its picture; deleting an account cascades to the profile and to everything posted under it; Sandbox rooms expire after two hours and are deleted within a day.',
          'No passwords of ours to lose — the login is held by Supabase Auth and we never see or store a password.',
          'Write-only submission — the key in your browser can add a survey response and cannot read, change or delete any response, including its own. Reading them needs a separate credential that never leaves our side.',
          'Local processing — Street View frames are analysed in your browser, not uploaded. The only image that reaches us is the one you post.',
          'Transparency — every third party that receives data is named on this page, and the fact that a posted picture is public is stated rather than buried.',
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
          describes in plain language what PLACER does with information.
        </P>
      </Section>
    </LegalPage>
  );
}

export default GdprPage;
