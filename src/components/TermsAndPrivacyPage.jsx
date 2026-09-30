/* PLACER — Terms and Privacy (Terms of Service, Privacy Policy and GDPR rights,
 * combined onto one page rather than split across three). */

import { useState } from 'react';
import { LegalPage, Chapter, Section, P, Bullets, Callout, Table, ExternalLink } from './LegalLayout';
import { Btn } from './UI';
import {
  OPERATOR,
  GOVERNING_LAW,
  GOOGLE_PRIVACY_URL,
  POSTHOG_PRIVACY_URL,
  SUPABASE_PRIVACY_URL,
  CLOUDFLARE_PRIVACY_URL,
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

export function TermsAndPrivacyPage({ t }) {
  return (
    <LegalPage
      t={t}
      title="Terms and Privacy"
      intro="The rules for using PLACER, how it handles your information, and your rights under the GDPR — in one place instead of three."
    >
      <Chapter t={t} title="Terms of Service" />

      <Callout t={t} icon="check" title="The short version">
        Use PLACER like a decent neighbour: nothing illegal, nothing that isn&rsquo;t yours to
        post, nothing meant to break the map for anyone else. Posting an imagination publishes
        it, under your name, on a map anyone can look at. We can remove content that breaks
        these terms, and you can stop using PLACER, or ask us to delete your account, whenever
        you like.
      </Callout>

      <Section t={t} title="Agreement to these terms">
        <P t={t}>
          These terms govern your use of PLACER, the web application operated by {OPERATOR.name}.
          By opening PLACER, building on the canvas, answering a survey, joining a Sandbox room or
          posting an imagination, you agree to them. If you do not agree, do not use PLACER.
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
          below, for how we handle anything posted by someone who should not have been able to.
        </P>
      </Section>

      <Section t={t} title="Your account">
        <P t={t}>
          Posting an imagination requires an account; reading the map, building on the canvas,
          answering the survey and joining a Sandbox room do not. You agree to give an accurate
          email address, to keep your password confidential, and to tell us if you believe your
          account has been used without your permission. You are responsible for what happens
          under your account, whether or not you were the one who did it.
        </P>
      </Section>

      <Section t={t} title="Acceptable use">
        <P t={t}>
          You agree not to, and not to help anyone else:
        </P>
        <Bullets t={t} items={[
          'Post anything illegal, infringing, defamatory, harassing, or that you do not have the rights to post.',
          'Impersonate another person or organisation, or misrepresent your affiliation with one.',
          'Scrape, mine or bulk-download imaginations, profiles or survey data.',
          'Probe, disable or bypass PLACER’s security, rate limits or authentication.',
          'Interfere with the map, the Sandbox or another user’s ability to use either.',
          'Automate account creation, posting, upvoting or Sandbox contributions.',
          'Try to access another account, or data that is not yours, without authorisation.',
        ]} />
        <P t={t}>
          We can remove content, close accounts, or restrict access for anyone who breaks these
          rules.
        </P>
      </Section>

      <Section t={t} title="Content you post">
        <P t={t}>
          You keep ownership of what you post. By posting an imagination, you promise you have
          the right to post it, and you grant PLACER the licence needed to display it on the map,
          on its own page, and anywhere else the app shows posted imaginations — which is the
          point of posting, and is described in full under Information PLACER holds, below. You
          can delete what you posted at any time, from your profile or from the imagination&rsquo;s
          own page, which removes it and its picture together.
        </P>
        <P t={t}>
          We may remove content that breaks these terms, infringes someone else&rsquo;s rights, or
          that we are required to remove by law, and we will tell you if we do.
        </P>
      </Section>

      <Section t={t} title="Third-party services">
        <P t={t}>
          PLACER shows map tiles and Street View imagery from Google Maps Platform, subject to
          Google&rsquo;s own terms; sends usage analytics to PostHog, if you accept them, subject to
          PostHog&rsquo;s own terms; and stores accounts, profiles, posted imaginations, survey
          answers and Sandbox rooms with Supabase. We are not responsible for the availability,
          accuracy or content of any third-party service PLACER relies on.
        </P>
      </Section>

      <Section t={t} title="Disclaimers">
        <P t={t}>
          PLACER is provided &ldquo;as is&rdquo;, without warranty of any kind. Imaginations are
          posted by other users, not vetted by us before they appear on the map, and are proposals,
          not professional planning, engineering or legal advice — nothing on PLACER should be
          treated as such. We do not guarantee PLACER will be available, uninterrupted, or free of
          errors.
        </P>
      </Section>

      <Section t={t} title="Limitation of liability">
        <P t={t}>
          To the extent the law allows, {OPERATOR.name} is not liable for indirect, incidental or
          consequential damages arising from your use of PLACER, or from content posted by other
          users. Nothing in these terms limits liability that cannot lawfully be limited.
        </P>
      </Section>

      <Section t={t} title="Termination">
        <P t={t}>
          You can stop using PLACER at any time, and can ask us to delete your account as
          described under Making a request to us, below. We can suspend or terminate an account
          that breaks these terms. Either way, an imagination someone has already seen or
          screenshotted is beyond anyone&rsquo;s reach — deletion stops us serving it, which is all
          deletion can ever do.
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
        PLACER has accounts, and posting is publishing. When you post an imagination it is
        stored on our server, not just in your browser, and it goes onto a map that anybody
        can look at &mdash; with the display name you chose next to it, and its picture at a
        web address that needs no account to open. What you have not posted stays on your
        device. The survey is stored when you submit it, along with an email address only if
        you give one. Usage analytics go to PostHog only if you accept the cookie banner;
        reject it and nothing is measured.
      </Callout>

      <Section t={t} title="Who this policy applies to">
        <P t={t}>
          This policy covers the PLACER web application, operated by {OPERATOR.name}. It applies
          to everyone who uses PLACER, whether or not you make an account and whether or not you
          post anything.
        </P>
      </Section>

      <Section t={t} title="Information PLACER holds">
        <P t={t}>
          <strong style={{ color: t.ink }}>Your account.</strong> Making an account means giving
          an email address and either choosing a password or signing in with Google. The login
          itself is held by Supabase Auth, our authentication provider: your address, a hash of
          your password &mdash; never the password itself &mdash; whether the address has been
          confirmed, and, if you use Google, the fact that this account is linked to that Google
          identity. Choosing Google means Google learns that you signed in to PLACER. An account
          is needed to post an imagination and for nothing else: you can look at the map, build
          on the canvas, answer the survey and join a Sandbox room without one.
        </P>
        <P t={t}>
          <strong style={{ color: t.ink }}>Your profile.</strong> Alongside the login we store a
          display name and, if you
          fill them in, a short bio, a location, a contact email, a website, a profile photo
          and a cover image. All of these are public: they are shown on your public profile page,
          which anyone with its link can open, next to the imaginations you have posted. The
          display name is also copied onto every imagination you post as the author, and it stays as it was on
          anything already posted if you rename yourself later. Pick a name you are happy to
          publish &mdash; it does not have to be your real one &mdash; and leave the optional
          fields empty if you would rather not share them. The email you sign in with is
          never shown; the contact email is a separate address you choose to publish.
          Anyone signed in to PLACER can find your profile by searching for your display
          name, and sees your name, location and profile photo in the suggestions.
        </P>
        <P t={t}>
          <strong style={{ color: t.ink }}>Organisations.</strong> If you create an organisation
          or are made an admin of one, we store its name and whatever its admins fill in &mdash; a
          description, a location, a contact email and a website &mdash; all of which are public on
          its page, together with the projects run in its name. We also store who its admins
          are. Which organisations you are an admin of is shown on your public profile. The full
          list of an organisation&rsquo;s admins is not public: its other admins see each
          admin&rsquo;s display name and the email they sign in with, since that is how an admin
          is added. If you leave an organisation, we keep a record that you used to be an admin,
          so that you can claim it back should it ever be left without one.
        </P>
        <P t={t}>
          <strong style={{ color: t.ink }}>Following.</strong> When you follow a person, an
          organisation or a project, we store that you follow it and when you started. This is
          public: your profile shows how many people follow you and how many people,
          organisations and projects you follow, and anyone who opens it can see both lists.
          Unfollowing removes the record.
        </P>
        <P t={t}>
          <strong style={{ color: t.ink }}>Imaginations you post.</strong> Pressing Post uploads
          your work to our database, where it becomes part of a shared, public map. The record
          holds the location you chose and its coordinates, whether the scene came from Street
          View or a top-down map, where the camera was pointing, every asset you placed and line
          you drew, the title, category and description you wrote, a running count of upvotes,
          the times it was created and last changed, your account and the display name you were
          using when you posted. Anyone can read all of that, signed in or not. Only you can
          change or delete it, which the database enforces rather than merely the app.
        </P>
        <P t={t}>
          <strong style={{ color: t.ink }}>The picture of it.</strong> Posting also uploads a
          flattened image of your scene &mdash; the Street View frame with your assets composited
          onto it &mdash; so the map has something to show. It is stored at a public web address,
          under a folder named after your account. Anyone who has that address can open it
          without an account, and search engines may reach it. Deleting the imagination deletes
          the picture with it.
        </P>
        <P t={t}>
          <strong style={{ color: t.ink }}>What stays in your browser.</strong> Work in progress
          is yours until you post it: an imagination you are still building, the asset library,
          comments, and your analytics choice are written to your browser&rsquo;s local storage,
          under keys beginning{' '}
          <code className="placer-mono" style={{ fontSize: 13, color: t.ink }}>placemaking_</code>.
          Signing in also keeps a session token there so you are not signed out on every reload.
          Anything you made before accounts existed stays where it is: it was saved under a policy
          that said it would never leave your device, so PLACER will not upload it to a public map
          without being asked.
        </P>
        <P t={t}>
          <strong style={{ color: t.ink }}>Survey answers.</strong> While you are answering, your
          answers are held in the page; nothing is sent until you press Submit. When you do, they
          are stored in our database so we can read them: the options you chose, anything you typed
          into a free-text field, and which survey it was. Please keep names and other personal
          details out of the free-text boxes, since they are stored exactly as written.
        </P>
        <P t={t}>
          <strong style={{ color: t.ink }}>Your email address, if you give one.</strong> The last
          step of the survey asks for an address, and only asks because you have said you would
          like to be involved beyond the survey — testing a prototype, a short interview, or a
          project as a case study. It is optional, it is stored alongside your answers, and it is
          used to reply to you about that and nothing else. You can leave it blank and still
          submit. It is separate from any account you may have, and neither is looked up from the
          other.
        </P>
        <P t={t}>
          <strong style={{ color: t.ink }}>Bug reports, if you send one.</strong> The &ldquo;Report
          a bug&rdquo; button stores what you type in our database, along with the page you were on,
          your browser&rsquo;s name and version, and your account if you are signed in, so we can
          find and fix the problem. Please keep personal details out of the text box, since it is
          stored exactly as written.
        </P>
        <P t={t}>
          <strong style={{ color: t.ink }}>Sandbox rooms, if you join one.</strong> The Sandbox
          experiments run entirely in your browser and save nothing — unless somebody opens a room
          and you join it with a PIN or a QR code. Then what you allocate in that experiment is
          stored in our database so the room can show everybody&rsquo;s answers combined, along with
          the display name your browser is set to, if you have set one. A room lasts two hours from
          being opened, unless a project opened it to run for longer — a week, 30 days or at most
          90 days, which the room shows while it is open. Whoever opened it can end it sooner.
          After that nobody can reach it, and it is deleted within a day.
        </P>
        <P t={t}>
          <strong style={{ color: t.ink }}>Imagery you work with.</strong> Street View frames
          are displayed in your browser for you to work with. The images are not sent to us.
          What does reach us is the picture you post, and only when you post it.
        </P>
        <P t={t}>
          <strong style={{ color: t.ink }}>Usage analytics, if you accept them.</strong> PLACER can
          send usage data to PostHog, an analytics provider, to see how the app is actually used
          and where it breaks. That covers the features you open, the events PLACER emits (such as
          posting an imagination), a recording of your session in the app, errors it hits, and the
          device, browser and IP-derived approximate location behind them. It is off until you
          accept: PLACER does not contact PostHog at all &mdash; no request, no cookie, no
          recording &mdash; until you do, and rejecting the banner keeps it that way. Analytics
          never carry your name or your email address: an address you give in the survey stays with
          your answers, your account address stays with your account, and neither is sent to
          PostHog.
        </P>
        <P t={t}>
          You can change that answer whenever you like, and see what is currently set, in the
          analytics controls further down this page, under GDPR.{' '}
          <ExternalLink t={t} href={POSTHOG_PRIVACY_URL}>Read PostHog&rsquo;s privacy policy</ExternalLink>
        </P>
        <P t={t}>
          <strong style={{ color: t.ink }}>Who else sees what we store.</strong> Accounts,
          profiles, posted imaginations, survey answers, bug reports and Sandbox rooms are all
          stored for us by Supabase, which hosts the database in the EU and processes them only
          on our instructions. The pictures you upload — imagination previews and profile
          covers — are stored for us by Cloudflare, in its R2 storage in the EU, on the same
          terms.{' '}
          <ExternalLink t={t} href={SUPABASE_PRIVACY_URL}>Read Supabase&rsquo;s privacy policy</ExternalLink>
          {' · '}
          <ExternalLink t={t} href={CLOUDFLARE_PRIVACY_URL}>Read Cloudflare&rsquo;s privacy policy</ExternalLink>
        </P>
        <P t={t}>
          <strong style={{ color: t.ink }}>What PLACER does not collect.</strong>
        </P>
        <Bullets t={t} items={[
          'No password of yours in readable form — the login is handled by our authentication provider, and we can neither see nor recover it.',
          'No advertising, no ad cookies, no data sold or shared with brokers.',
          'No analytics at all unless you accept them, and none for anyone who rejects.',
          'No record of who upvoted what — a vote adds one to a count and nothing else, which is also why it can be pressed twice.',
          'No server-side log of the places you look at. Browsing the map is not recorded; only what you post is.',
          'No account required to read the map, build on the canvas, answer the survey or join a room.',
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

      <Section t={t} title="How long it is kept">
        <P t={t}>
          An imagination you post stays on the map, and its picture stays at its public address,
          until you delete it or delete your account. Deleting either removes both. Your account
          and profile are kept until you ask us to delete them; deleting the account takes the
          profile and everything posted under it with it.
        </P>
        <P t={t}>
          Anything still only in your browser stays there until you delete it or clear your
          browsing data for this site — PLACER sets no expiry. Because that storage is
          per-browser and per-device, unposted work does not follow you to another computer, and
          anyone else using the same browser profile can see it.
        </P>
        <P t={t}>
          Survey answers are kept while this research runs. Sandbox rooms expire two hours after
          being opened, or at most 90 days after for one a project opened to run longer, and are
          deleted within a day of ending. Analytics you have consented to are held for
          as long as our PostHog project is configured to keep them, and withdrawing consent stops
          anything further being collected.
        </P>
      </Section>

      <Section t={t} title="Your choices">
        <Bullets t={t} items={[
          'Use PLACER without an account — everything except posting works without one.',
          'Delete an imagination you posted, from your profile or the page for that imagination. The record and its picture both go.',
          'Change your display name or bio at any time in your profile, or sign out to stop being identified as its author on this device.',
          'Ask us to delete your account, which removes the profile and every imagination posted under it.',
          'Accept or reject analytics on the banner, and change that answer later further down this page, under GDPR.',
          'Download everything PLACER holds in this browser, or erase all of it at once, further down this page, under GDPR.',
          'Clear site data in your browser settings to remove everything PLACER has stored locally, including the seeded asset library.',
          'Use a private or incognito window, and post nothing, if you would rather nothing persisted at all.',
        ]} />
        <P t={t}>
          If you are in the EU or UK, the GDPR section below sets out your legal rights and how
          to exercise them.
        </P>
      </Section>

      <Section t={t} title="Children">
        <P t={t}>
          PLACER is intended for general community use and is not directed at children under 13,
          and we ask that nobody under 13 make an account or post. We do not knowingly collect
          information from them. If you believe a child has given us an email address, made an
          account or posted an imagination, email us and we will delete it.
        </P>
      </Section>

      <Section t={t} title="Changes to this policy">
        <P t={t}>
          This policy was updated when PLACER moved from keeping your work in your browser to
          storing what you post on our server. If it starts sending data anywhere it does not
          already, or collecting anything not described here, this page will be updated before
          that happens and the date at the top will change. Anything that would widen what we
          collect will be asked for, not assumed, and nothing you saved under an earlier version
          of this policy is uploaded without you choosing to post it. Significant changes will be
          announced in the app.
        </P>
      </Section>

      <Chapter t={t} title="GDPR" />

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
              'Two hours from the room being opened — or up to 90 days, for a room a project opened to run longer — or sooner if the facilitator closes it. After that it cannot be reached at all, and it is deleted within a day',
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
          Everything we store — accounts and profiles, the imaginations you post, survey answers
          and Sandbox rooms — is held in a Postgres database hosted by Supabase in the EU, acting
          as our processor. The pictures — imagination previews and profile covers — are held in
          Cloudflare R2 storage in the EU, with Cloudflare acting as our processor. Supabase Inc.
          and Cloudflare, Inc. are US companies, so support access from outside the EEA is likewise
          covered by the Standard Contractual Clauses in their data processing agreements. The
          pictures are served from a public address through Cloudflare&rsquo;s network, which means
          they may be fetched from wherever the person looking at the map happens to be.
        </P>
        <P t={t}>
          <ExternalLink t={t} href={GOOGLE_PRIVACY_URL}>Google&rsquo;s privacy policy</ExternalLink>
          {' · '}
          <ExternalLink t={t} href={POSTHOG_PRIVACY_URL}>PostHog&rsquo;s privacy policy</ExternalLink>
          {' · '}
          <ExternalLink t={t} href={SUPABASE_PRIVACY_URL}>Supabase&rsquo;s privacy policy</ExternalLink>
          {' · '}
          <ExternalLink t={t} href={CLOUDFLARE_PRIVACY_URL}>Cloudflare&rsquo;s privacy policy</ExternalLink>
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
          'Storage limitation — deleting an imagination deletes its picture; deleting an account cascades to the profile and to everything posted under it; Sandbox rooms expire after two hours (at most 90 days for a project’s long-running room) and are deleted within a day.',
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
