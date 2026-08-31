/* PLACER — Privacy Policy */

import { LegalPage, Section, P, Bullets, Callout, ExternalLink, PageLink } from './LegalLayout';
import { OPERATOR, GOOGLE_PRIVACY_URL, POSTHOG_PRIVACY_URL } from '../legal';

export function PrivacyPage({ t, onNavigate }) {
  return (
    <LegalPage
      t={t}
      title="Privacy Policy"
      intro="How PLACER handles information when you explore a location, place assets, and share a vision for a public space."
    >
      <Callout t={t} icon="check" title="The short version">
        PLACER has no user accounts. The ideas you build stay in your own browser, on the device
        you built them on. Two things do leave your device: the map and Street View imagery
        request PLACER makes to Google on your behalf, and &mdash; only if you accept the cookie
        banner &mdash; usage analytics sent to PostHog. Reject it and nothing is measured.
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
          <strong style={{ color: t.ink }}>Survey answers.</strong> If you fill in the survey,
          your answers are held in the page while you are answering and are discarded when you
          close or reload it. Nothing is submitted anywhere.
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
          never carry your name or email address, because PLACER has neither.
        </P>
        <P t={t}>
          You can change that answer whenever you like, and see what is currently set, in the{' '}
          <PageLink t={t} onClick={() => onNavigate('gdpr')}>analytics controls on the GDPR page</PageLink>.{' '}
          <ExternalLink t={t} href={POSTHOG_PRIVACY_URL}>Read PostHog&rsquo;s privacy policy</ExternalLink>
        </P>
        <P t={t}>
          <strong style={{ color: t.ink }}>What PLACER does not collect.</strong>
        </P>
        <Bullets t={t} items={[
          'No account, name, email address or password — there is nothing to sign up for.',
          'No advertising, no ad cookies, no data sold or shared with brokers.',
          'No analytics at all unless you accept them, and none for anyone who rejects.',
          'No server-side log of the places you look at, because there is no PLACER server.',
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
          Saved ideas stay in your browser until you delete them or clear your browsing data
          for this site — PLACER sets no expiry. Because storage is per-browser and per-device,
          your work does not follow you to another computer, and anyone else using the same
          browser profile can see it.
        </P>
        <P t={t}>
          Analytics you have consented to are held for as long as our PostHog project is
          configured to keep them, and withdrawing consent stops anything further being collected.
        </P>
      </Section>

      <Section t={t} title="Your choices">
        <Bullets t={t} items={[
          'Accept or reject analytics on the banner, and change that answer later on the GDPR page.',
          'Delete a single idea from the dashboard where it is listed.',
          'Download everything PLACER holds on this device, or erase all of it at once, from the GDPR page.',
          'Clear site data in your browser settings to remove everything PLACER has stored, including the seeded asset library.',
          'Use a private or incognito window if you would rather nothing persisted at all.',
        ]} />
        <P t={t}>
          If you are in the EU or UK, the{' '}
          <PageLink t={t} onClick={() => onNavigate('gdpr')}>GDPR page</PageLink>{' '}
          sets out your legal rights and how to exercise them.
        </P>
      </Section>

      <Section t={t} title="Children">
        <P t={t}>
          PLACER is intended for general community use and is not directed at children under 13.
          We do not knowingly collect information from them — and, as above, PLACER collects no
          identifying information from anyone.
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

      <Section t={t} title="Contact">
        <P t={t}>
          Questions about this policy can go to{' '}
          <ExternalLink t={t} href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</ExternalLink>,
          or by post to {OPERATOR.name}, {OPERATOR.address}.
        </P>
      </Section>
    </LegalPage>
  );
}

export default PrivacyPage;
