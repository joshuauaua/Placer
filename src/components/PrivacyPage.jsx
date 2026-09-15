/* PLACER — Privacy Policy */

import { LegalPage, Section, P, Bullets, Callout, ExternalLink, PageLink } from './LegalLayout';
import { OPERATOR, GOOGLE_PRIVACY_URL, POSTHOG_PRIVACY_URL, SUPABASE_PRIVACY_URL } from '../legal';

export function PrivacyPage({ t, onNavigate }) {
  return (
    <LegalPage
      t={t}
      title="Privacy Policy"
      intro="How PLACER handles information when you explore a location, place assets, and share a vision for a public space."
    >
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
          display name and, if you write one, a short bio. The display name is public: it is
          copied onto every imagination you post as the author, and it stays as it was on
          anything already posted if you rename yourself later. Pick a name you are happy to
          publish &mdash; it does not have to be your real one.
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
          <strong style={{ color: t.ink }}>Sandbox rooms, if you join one.</strong> The Sandbox
          experiments run entirely in your browser and save nothing — unless somebody opens a room
          and you join it with a PIN or a QR code. Then what you allocate in that experiment is
          stored in our database so the room can show everybody&rsquo;s answers combined, along with
          the display name your browser is set to, if you have set one. A room lasts two hours from
          being opened, and whoever opened it can end it sooner. After that nobody can reach it,
          and it is deleted within a day.
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
          You can change that answer whenever you like, and see what is currently set, in the{' '}
          <PageLink t={t} onClick={() => onNavigate('gdpr')}>analytics controls on the GDPR page</PageLink>.{' '}
          <ExternalLink t={t} href={POSTHOG_PRIVACY_URL}>Read PostHog&rsquo;s privacy policy</ExternalLink>
        </P>
        <P t={t}>
          <strong style={{ color: t.ink }}>Who else sees what we store.</strong> Accounts,
          profiles, posted imaginations, their pictures, survey answers and Sandbox rooms are all
          stored for us by Supabase, which hosts the database and file storage in the EU and
          processes them only on our instructions.{' '}
          <ExternalLink t={t} href={SUPABASE_PRIVACY_URL}>Read Supabase&rsquo;s privacy policy</ExternalLink>
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
          being opened and are deleted within a day. Analytics you have consented to are held for
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
          'Accept or reject analytics on the banner, and change that answer later on the GDPR page.',
          'Download everything PLACER holds in this browser, or erase all of it at once, from the GDPR page.',
          'Clear site data in your browser settings to remove everything PLACER has stored locally, including the seeded asset library.',
          'Use a private or incognito window, and post nothing, if you would rather nothing persisted at all.',
        ]} />
        <P t={t}>
          If you are in the EU or UK, the{' '}
          <PageLink t={t} onClick={() => onNavigate('gdpr')}>GDPR page</PageLink>{' '}
          sets out your legal rights and how to exercise them.
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
