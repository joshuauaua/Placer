/* PLACER — account settings: your name, and what the app is allowed to measure.
 *
 * A header that stays put while the page scrolls, then the settings grouped into
 * categories. Nothing is edited on that first screen: each category is a list of
 * options, and an option opens its group of settings in place of the list, with a
 * way back. Which option is open is local state, not a route. */

import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Avatar, Btn, LoadingMark } from './UI';
import { Icon } from './Icon';
import { PageHeader } from './PageHeader';
import { readConsent, grantConsent, denyConsent, GRANTED, DENIED } from '../analytics';
import { ImagePicker } from './ImagePicker';
import {
  removeProfileImageFile, updatePassword, uploadProfilePhoto,
} from '../services/auth';
import { isSupabaseConfigured, readPreferences, savePreferences } from '../services/notifications';
import { googleMapsApiKey, isGoogleMapsConfigured, loadGoogleMaps } from '../lib/googleMaps';

// The same floor AuthPage and ResetPasswordPage ask for.
const MIN_PASSWORD = 8;

// Copied from DescribePage rather than shared, matching how the form styling is
// already duplicated across the pages that need it.
const inputStyle = (t) => ({
  width: '100%',
  padding: '12px 16px',
  fontSize: 15,
  border: `1.5px solid ${t.line}`,
  borderRadius: 12,
  background: t.chrome,
  color: t.ink,
  fontFamily: 'var(--placer-font)',
  outline: 'none',
});

function Card({ t, title, children }) {
  return (
    <section style={{ padding: 28, marginBottom: 24, background: t.surface, borderRadius: 12,
      border: `1px solid ${t.line}`, boxShadow: t.shadow }}>
      <h3 style={{ fontSize: 16, fontWeight: 700, color: t.ink, marginBottom: 8 }}>{title}</h3>
      {children}
    </section>
  );
}

// A category: its heading over a rule, then its options. One whose options are all
// account-only renders nothing on the local, no-account path.
function Category({ t, title, children }) {
  const options = [].concat(children).filter(Boolean);
  if (options.length === 0) return null;
  return (
    <section style={{ marginBottom: 40 }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: t.ink, letterSpacing: '-0.01em',
        padding: '0 4px 12px', marginBottom: 16, borderBottom: `1px solid ${t.line}` }}>
        {title}
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{options}</div>
    </section>
  );
}

// One option: an icon in its own cell, a title over what it covers, and a chevron.
// The whole row is the button, named by its title.
function OptionRow({ t, icon, title, description, onClick }) {
  return (
    <button type="button" onClick={onClick} aria-label={title} className="placer-settings-option"
      style={{ all: 'unset', boxSizing: 'border-box', width: '100%', cursor: 'pointer',
        display: 'grid', gridTemplateColumns: '80px 1fr 56px', alignItems: 'stretch', minHeight: 84,
        background: t.surface, border: `1px solid ${t.line}`, borderRadius: 12, fontFamily: 'var(--placer-font)' }}>
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRight: `1px solid ${t.line}`, color: t.ink }}>
        <Icon name={icon} size={28} stroke={1.8} />
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4,
        padding: '14px 20px', minWidth: 0 }}>
        <span style={{ fontSize: 16, fontWeight: 500, color: t.ink }}>{title}</span>
        <span style={{ fontSize: 14, color: t.inkDim, lineHeight: 1.45 }}>{description}</span>
      </span>
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.ink }}>
        <Icon name="chevRight" size={20} stroke={2} />
      </span>
    </button>
  );
}

function DisplayName({ t, profile, onSaveProfile }) {
  const [name, setName] = useState(profile?.name ?? '');
  const [status, setStatus] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'error'

  const trimmed = name.trim();
  const unchanged = trimmed === (profile?.name ?? '');

  // Saving is a request now, not a localStorage write, so it can be slow and it can
  // fail. Both states are shown rather than swallowed: a name that silently did not
  // save is worse than one that says so.
  const handleSave = async () => {
    setStatus('saving');
    try {
      await onSaveProfile({ name: trimmed });
      setStatus('saved');
    } catch (err) {
      console.error('Could not save your name:', err);
      setStatus('error');
    }
  };

  return (
    <Card t={t} title="Display name">
      <p style={{ fontSize: 15, color: t.inkDim, lineHeight: 1.6, marginBottom: 20 }}>
        The name shown on the imaginations you post from now on. Changing it does not rename
        what you have already posted.
      </p>
      <label htmlFor="settings-display-name"
        style={{ display: 'block', fontSize: 14, fontWeight: 700, color: t.ink, marginBottom: 8 }}>
        Your name
      </label>
      <input
        id="settings-display-name"
        type="text"
        value={name}
        onChange={(e) => { setName(e.target.value); setStatus('idle'); }}
        style={{ ...inputStyle(t), maxWidth: 380, marginBottom: 20 }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <Btn t={t} variant="primary" icon="check" onClick={handleSave}
          disabled={!trimmed || unchanged || status === 'saving'}>
          {status === 'saving' ? 'Saving…' : 'Save name'}
        </Btn>
        {status === 'saved' && (
          <span role="status" style={{ fontSize: 14, color: t.inkDim, fontWeight: 500 }}>
            Saved.
          </span>
        )}
        {status === 'error' && (
          <span role="alert" style={{ fontSize: 14, color: t.ink, fontWeight: 500 }}>
            Could not save that. Try again.
          </span>
        )}
      </div>
    </Card>
  );
}

// Bio and Location share this shape with each other but not with DisplayName: both
// are optional, so there is no "blank is invalid" rule to encode, and one of them
// wants a textarea. DisplayName stays its own component rather than becoming a third
// call to this one — a required field with its own copy is a different enough thing
// that folding it in would mean threading an "isRequired" branch through a function
// two of its three uses do not need.
function ProfileField({ t, profile, onSaveProfile, fieldKey, title, description, label, id, placeholder, multiline,
  inputType = 'text' }) {
  const [value, setValue] = useState(profile?.[fieldKey] ?? '');
  const [status, setStatus] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'error'

  const trimmed = value.trim();
  const unchanged = trimmed === (profile?.[fieldKey] ?? '');

  const handleSave = async () => {
    setStatus('saving');
    try {
      await onSaveProfile({ [fieldKey]: trimmed });
      setStatus('saved');
    } catch (err) {
      console.error(`Could not save your ${label.toLowerCase()}:`, err);
      setStatus('error');
    }
  };

  const fieldStyle = { ...inputStyle(t), maxWidth: 380, marginBottom: 20,
    ...(multiline ? { resize: 'vertical', minHeight: 88, fontFamily: 'var(--placer-font)' } : {}) };

  return (
    <Card t={t} title={title}>
      <p style={{ fontSize: 15, color: t.inkDim, lineHeight: 1.6, marginBottom: 20 }}>
        {description}
      </p>
      <label htmlFor={id}
        style={{ display: 'block', fontSize: 14, fontWeight: 700, color: t.ink, marginBottom: 8 }}>
        {label}
      </label>
      {multiline ? (
        <textarea id={id} rows={4} value={value} placeholder={placeholder}
          onChange={(e) => { setValue(e.target.value); setStatus('idle'); }}
          style={fieldStyle} />
      ) : (
        <input id={id} type={inputType} value={value} placeholder={placeholder}
          onChange={(e) => { setValue(e.target.value); setStatus('idle'); }}
          style={fieldStyle} />
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <Btn t={t} variant="primary" icon="check" onClick={handleSave}
          disabled={unchanged || status === 'saving'}>
          {status === 'saving' ? 'Saving…' : `Save ${label.toLowerCase()}`}
        </Btn>
        {status === 'saved' && (
          <span role="status" style={{ fontSize: 14, color: t.inkDim, fontWeight: 500 }}>
            Saved.
          </span>
        )}
        {status === 'error' && (
          <span role="alert" style={{ fontSize: 14, color: t.ink, fontWeight: 500 }}>
            Could not save that. Try again.
          </span>
        )}
      </div>
    </Card>
  );
}

/**
 * The location, with place suggestions as it is typed — the same Google Places search
 * as the map's own box, but only towns, cities and regions, since what is typed here is
 * shown on the public profile. Choosing a suggestion also keeps where it is
 * (profile.locationPoint), which is where the Explore map opens; typed text that was
 * not chosen from the list is saved as it is, with no place, and Explore opens where it
 * always has. Without a Maps key it is a plain text field.
 */
function LocationField({ t, profile, onSaveProfile }) {
  const [value, setValue] = useState(profile?.location ?? '');
  // The place behind `value`, when it came from a suggestion; null once edited by hand.
  const [point, setPoint] = useState(profile?.locationPoint ?? null);
  const [status, setStatus] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'error'
  const inputRef = useRef(null);

  useEffect(() => {
    if (!isGoogleMapsConfigured()) return undefined;
    let cancelled = false;
    let listener = null;

    loadGoogleMaps(googleMapsApiKey())
      .then(() => {
        if (cancelled || !inputRef.current || !window.google?.maps?.places) return;
        const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
          types: ['(regions)'],
          fields: ['geometry', 'formatted_address', 'name'],
        });
        listener = autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace();
          const location = place?.geometry?.location;
          if (!location) return;
          setValue(place.formatted_address || place.name || '');
          setPoint({ lat: location.lat(), lng: location.lng() });
          setStatus('idle');
        });
      })
      .catch((err) => console.error('Could not load place suggestions:', err));

    return () => {
      cancelled = true;
      listener?.remove?.();
    };
  }, []);

  const trimmed = value.trim();
  const saved = profile?.locationPoint ?? null;
  const samePoint = (point?.lat === saved?.lat && point?.lng === saved?.lng);
  const unchanged = trimmed === (profile?.location ?? '') && samePoint;

  const handleSave = async () => {
    setStatus('saving');
    try {
      // No text, no place: clearing the location clears where Explore opens too.
      await onSaveProfile({ location: trimmed, locationPoint: trimmed ? point : null });
      setStatus('saved');
    } catch (err) {
      console.error('Could not save your location:', err);
      setStatus('error');
    }
  };

  return (
    <Card t={t} title="Location">
      <p style={{ fontSize: 15, color: t.inkDim, lineHeight: 1.6, marginBottom: 20 }}>
        Where you&rsquo;re based, shown on your public profile under your name. Pick your town
        or city from the suggestions and the Explore map will open there. Optional.
      </p>
      <label htmlFor="settings-location"
        style={{ display: 'block', fontSize: 14, fontWeight: 700, color: t.ink, marginBottom: 8 }}>
        Location
      </label>
      <input id="settings-location" ref={inputRef} type="text" value={value} placeholder="e.g. Malmö, Sweden"
        autoComplete="off"
        onChange={(e) => { setValue(e.target.value); setPoint(null); setStatus('idle'); }}
        // Enter picks a suggestion in the Places list; it must not do anything else here.
        onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
        style={{ ...inputStyle(t), maxWidth: 380, marginBottom: 12 }} />
      <p style={{ fontSize: 13.5, color: t.inkFaint, marginBottom: 20 }}>
        {point
          ? 'Explore opens here.'
          : trimmed
            ? 'Not a place from the suggestions, so Explore opens where it always does.'
            : 'No location, so Explore opens where it always does.'}
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <Btn t={t} variant="primary" icon="check" onClick={handleSave}
          disabled={unchanged || status === 'saving'}>
          {status === 'saving' ? 'Saving…' : 'Save location'}
        </Btn>
        {status === 'saved' && (
          <span role="status" style={{ fontSize: 14, color: t.inkDim, fontWeight: 500 }}>Saved.</span>
        )}
        {status === 'error' && (
          <span role="alert" style={{ fontSize: 14, color: t.ink, fontWeight: 500 }}>
            Could not save that. Try again.
          </span>
        )}
      </div>
    </Card>
  );
}

// Point the profile at a newly uploaded picture (or at none), then delete the one it
// replaces. In that order, so the profile never points at a file that is already gone.
async function replaceProfileImage({ onSaveProfile, field, previous, nextPath }) {
  await onSaveProfile({ [field]: nextPath });
  if (previous && previous !== nextPath) await removeProfileImageFile(previous);
}

// The photo in the avatar circle, shown instead of the initials a new account starts
// with. Uploading saves straight away — there is nothing to review between choosing a
// file and wanting it — and the old file is deleted once the profile points at the new
// one. Account path only: photos live in the R2 bucket, and a local-only visitor has
// no account to upload one with.
function ProfilePhotoPicker({ t, profile, onSaveProfile }) {
  const photo = profile?.photo ?? null;
  const replace = (nextPath) => replaceProfileImage({
    onSaveProfile, field: 'photoPath', previous: profile?.photoPath ?? null, nextPath });

  return (
    <Card t={t} title="Profile photo">
      <p style={{ fontSize: 15, color: t.inkDim, lineHeight: 1.6, marginBottom: 20 }}>
        A picture of you, shown in the circle wherever your avatar appears. Until you add
        one, the circle shows your initials. It is cropped to a square from the middle, and
        saved without its location data. Optional.
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
        <Avatar name={profile?.name ?? ''} photo={photo} size={72} />
        <ImagePicker t={t} hasImage={!!photo} uploadLabel="Upload a photo" replaceLabel="Replace photo"
          onUpload={async (file) => replace(await uploadProfilePhoto(file))} onRemove={() => replace(null)} />
      </div>
    </Card>
  );
}

// The organisations this account runs, and where to create one. Account path only:
// organisations live in Supabase, and a local-only visitor has no account to run one.
function Organisations({ t, organisations, onNewOrganisation, onOpenOrganisationDashboard }) {
  return (
    <Card t={t} title="Organisations">
      <p style={{ fontSize: 15, color: t.inkDim, lineHeight: 1.6, marginBottom: 20 }}>
        A page for a municipality, studio, association or any other group you are part of,
        with its own public page, admins, and projects run in its name. Once you run one, it
        is under Organisations in the side menu.
      </p>
      {organisations.length > 0 && (
        <ul style={{ listStyle: 'none', margin: '0 0 20px', padding: 0 }}>
          {organisations.map((organisation) => (
            <li key={organisation.id} style={{ borderTop: `1px solid ${t.line}` }}>
              <a href={`/organisations/${organisation.id}/dashboard`}
                onClick={(e) => { e.preventDefault(); onOpenOrganisationDashboard?.(organisation.id); }}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0',
                  fontSize: 15, fontWeight: 700, color: t.ink, textDecoration: 'none' }}>
                <Icon name="building" size={18} stroke={2} />
                {organisation.name}
              </a>
            </li>
          ))}
        </ul>
      )}
      <Btn t={t} variant="outline" size="sm" icon="plus" onClick={onNewOrganisation}>
        Create an organisation
      </Btn>
    </Card>
  );
}

// Only reachable on the account path — a local-only visitor has no password to
// change, and no `email` is what tells this apart from that world (see useIdentity.js).
function ChangePassword({ t }) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < MIN_PASSWORD || busy) return;

    setBusy(true);
    setError(null);
    try {
      await updatePassword(password);
      setPassword('');
      setDone(true);
    } catch (err) {
      console.error('Could not change your password:', err);
      setError(err?.message ?? 'Could not change your password. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card t={t} title="Password">
      <p style={{ fontSize: 15, color: t.inkDim, lineHeight: 1.6, marginBottom: 20 }}>
        Change the password you sign in with.
      </p>
      <form onSubmit={handleSubmit}>
        <label htmlFor="settings-new-password"
          style={{ display: 'block', fontSize: 14, fontWeight: 700, color: t.ink, marginBottom: 8 }}>
          New password
        </label>
        <input
          id="settings-new-password"
          type="password"
          value={password}
          autoComplete="new-password"
          onChange={(e) => { setPassword(e.target.value); setDone(false); }}
          style={{ ...inputStyle(t), maxWidth: 380, marginBottom: 8 }}
        />
        <div style={{ fontSize: 13, color: t.inkDim, marginBottom: 20 }}>
          At least {MIN_PASSWORD} characters.
        </div>

        {error && (
          <div role="alert" style={{ marginBottom: 18, padding: 14, borderRadius: 12,
            background: '#F5F5F5', borderLeft: '4px solid #B3261E', fontSize: 14,
            color: t.ink, fontWeight: 500, lineHeight: 1.5, maxWidth: 380 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Btn t={t} variant="primary" icon="check" type="submit"
            disabled={password.length < MIN_PASSWORD || busy}>
            {busy ? 'Saving…' : 'Save new password'}
          </Btn>
          {done && (
            <span role="status" style={{ fontSize: 14, color: t.inkDim, fontWeight: 500 }}>
              Changed.
            </span>
          )}
        </div>
      </form>
    </Card>
  );
}

// The same two calls the Terms and Privacy page makes, so the two screens cannot
// drift apart. The wording stays short here on purpose: the full Article 13 text,
// and the export and erasure controls, live on that page rather than being restated.
function Analytics({ t, onNavigate }) {
  const [decision, setDecision] = useState(() => readConsent());

  const choose = (record, next) => () => {
    record();
    setDecision(next);
  };

  const state = decision === GRANTED
    ? 'Analytics are on for this browser.'
    : decision === DENIED
      ? 'Analytics are off. Nothing is captured or stored.'
      : 'No choice recorded yet. Analytics are off until you accept.';

  return (
    <Card t={t} title="Analytics">
      <p style={{ fontSize: 15, color: t.inkDim, lineHeight: 1.6, marginBottom: 20 }}>
        Whether PLACER may load PostHog to measure how the app is used. You can change this
        whenever you like.
      </p>
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
        {state}{' '}
        <span
          onClick={() => onNavigate('terms')}
          role="link"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onNavigate('terms'); }}
          style={{ color: t.ink, fontWeight: 500, cursor: 'pointer', textDecoration: 'underline' }}>
          What is collected, and your rights
        </span>
      </div>
    </Card>
  );
}

// One row per category the pasted feature list describes, in that order. `inapp`
// and `email` are the notification_preferences columns this row's two checkboxes
// read and write.
const NOTIFICATION_KINDS = [
  { inapp: 'engagement_inapp', email: 'engagement_email', title: 'Engagement',
    description: 'When someone comments on or votes for your imaginations.' },
  { inapp: 'activity_inapp', email: 'activity_email', title: 'Activity',
    description: 'When a Project, City or User you follow posts news or new Toolkit results.' },
  { inapp: 'follower_inapp', email: 'follower_email', title: 'Followers',
    description: 'When someone follows your profile.' },
  { inapp: 'system_inapp', email: 'system_email', title: 'System',
    description: 'Platform announcements and account maintenance.' },
];

const checkboxLabelStyle = { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500 };

function NotificationPreferences({ t }) {
  const [prefs, setPrefs] = useState(null); // null while loading
  const [error, setError] = useState(null);
  const [savingKey, setSavingKey] = useState(null);

  useEffect(() => {
    // Preferences live in Supabase — see services/notifications.js's header. Nothing
    // to load or save without a project configured, so this card renders nothing
    // rather than a permanent "could not load" for a deployment that has no backend.
    if (!isSupabaseConfigured()) return undefined;

    let cancelled = false;
    readPreferences()
      .then((loaded) => { if (!cancelled) setPrefs(loaded); })
      .catch((err) => {
        console.error('Could not load your notification settings:', err);
        if (!cancelled) setError('Could not load your notification settings.');
      });
    return () => { cancelled = true; };
  }, []);

  if (!isSupabaseConfigured()) return null;

  const toggle = (key) => async (e) => {
    const value = e.target.checked;
    setPrefs((current) => ({ ...current, [key]: value }));
    setSavingKey(key);
    setError(null);
    try {
      await savePreferences({ [key]: value });
    } catch (err) {
      console.error('Could not save your notification settings:', err);
      setError('Could not save that. Try again.');
      // Roll the checkbox back — a toggle that silently did not save is worse
      // than one that visibly reverts.
      setPrefs((current) => ({ ...current, [key]: !value }));
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <Card t={t} title="Notification preferences">
      <p style={{ fontSize: 15, color: t.inkDim, lineHeight: 1.6, marginBottom: 20 }}>
        What you hear about, and where. Email is sent through Resend, which is not wired
        up yet — the Email choice below is saved for when it is, but nothing is emailed
        in the meantime.
      </p>

      {prefs === null && !error && (
        <LoadingMark size={28} />
      )}

      {error && (
        <div role="alert" style={{ marginBottom: 18, padding: 14, borderRadius: 12,
          background: '#F5F5F5', borderLeft: '4px solid #B3261E', fontSize: 14,
          color: t.ink, fontWeight: 500, lineHeight: 1.5 }}>
          {error}
        </div>
      )}

      {prefs && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '4px 20px',
            alignItems: 'center' }}>
            <span />
            <span style={{ fontSize: 12, fontWeight: 700, color: t.inkFaint, textTransform: 'uppercase',
              letterSpacing: '0.04em' }}>In-app</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: t.inkFaint, textTransform: 'uppercase',
              letterSpacing: '0.04em' }}>Email</span>

            {NOTIFICATION_KINDS.map(({ inapp, email, title, description }) => (
              <Fragment key={inapp}>
                <div style={{ padding: '10px 0' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: t.ink }}>{title}</div>
                  <div style={{ fontSize: 12.5, color: t.inkDim, lineHeight: 1.4, marginTop: 2 }}>
                    {description}
                  </div>
                </div>
                <label style={checkboxLabelStyle}>
                  <input type="checkbox" checked={Boolean(prefs[inapp])}
                    disabled={savingKey === inapp} onChange={toggle(inapp)} />
                </label>
                <label style={checkboxLabelStyle}>
                  <input type="checkbox" checked={Boolean(prefs[email])}
                    disabled={savingKey === email} onChange={toggle(email)} />
                </label>
              </Fragment>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

export function SettingsPage({ t, profile, email, onSaveProfile, onNavigate,
  organisations = [], onNewOrganisation, onOpenOrganisationDashboard }) {
  // The open option's key, or null for the list of them.
  const [open, setOpen] = useState(null);
  const topRef = useRef(null);

  // Opening an option, or going back, starts at the top rather than wherever the
  // list had been scrolled to. scrollIntoView is missing under jsdom, hence the `?.`.
  useLayoutEffect(() => {
    topRef.current?.scrollIntoView?.({ block: 'start' });
  }, [open]);

  const profileArgs = { t, profile, onSaveProfile };
  // Every option, in the order the categories list them. `show` leaves out the ones
  // this account cannot use; `cards` is what opening it shows, and an option with
  // `onSelect` instead goes somewhere else in the app.
  const options = {
    profile: {
      category: 'Profile Settings', icon: 'user', title: 'Edit your profile', show: true,
      description: 'Your name, bio, location, contact email and website',
      cards: (
        <>
          <DisplayName {...profileArgs} />
          <ProfileField {...profileArgs} fieldKey="bio"
            title="Bio" label="Bio" id="settings-bio" multiline
            description="A couple of lines about you, shown on your public profile. Optional."
            placeholder="What you're into, or what brought you here." />
          <LocationField {...profileArgs} />
          <ProfileField {...profileArgs} fieldKey="contactEmail"
            title="Contact email" label="Contact email" id="settings-contact-email" inputType="email"
            description="An address people can reach you at, shown on your public profile. It does not have to be the one you sign in with, which is never shown. Optional."
            placeholder="e.g. hello@example.com" />
          <ProfileField {...profileArgs} fieldKey="website"
            title="Website" label="Website" id="settings-website" inputType="url"
            description="A link shown on your public profile. Optional."
            placeholder="e.g. example.com" />
        </>
      ),
    },
    photo: {
      category: 'Profile Settings', icon: 'image', title: 'Profile photo', show: Boolean(email),
      description: 'The photo in your avatar circle, in place of your initials',
      cards: <ProfilePhotoPicker {...profileArgs} />,
    },
    password: {
      category: 'Account', icon: 'lock', title: 'Change your password', show: Boolean(email),
      description: 'Set a new password to sign in with',
      cards: <ChangePassword t={t} />,
    },
    organisations: {
      category: 'Account', icon: 'building', title: 'Manage your organisations',
      show: Boolean(email && onNewOrganisation),
      description: organisations.length > 0
        ? 'Open an organisation you run, or create another'
        : 'Create a page for a municipality, studio or association',
      cards: (
        <Organisations t={t} organisations={organisations} onNewOrganisation={onNewOrganisation}
          onOpenOrganisationDashboard={onOpenOrganisationDashboard} />
      ),
    },
    notifications: {
      category: 'Notifications', icon: 'bell', title: 'Notification preferences',
      show: Boolean(email) && isSupabaseConfigured(),
      description: 'What you hear about, in the app and by email',
      cards: <NotificationPreferences t={t} />,
    },
    analytics: {
      category: 'Data and Privacy', icon: 'chart', title: 'Analytics', show: true,
      description: 'Accept or reject PostHog measuring how the app is used in this browser',
      cards: <Analytics t={t} onNavigate={onNavigate} />,
    },
    data: {
      category: 'Data and Privacy', icon: 'arrowDown', title: 'Your data', show: true,
      description: 'Download or erase what PLACER holds, on the Terms and Privacy page',
      onSelect: () => onNavigate('terms'),
    },
  };

  const current = open ? options[open] : null;
  const categories = ['Profile Settings', 'Account', 'Notifications', 'Data and Privacy'];

  return (
    <div ref={topRef} style={{ width: '100%', height: '100%', overflowY: 'auto', background: t.page,
      padding: '0 40px 48px', scrollMarginTop: 64 }} className="placer-scroll">
      <PageHeader t={t} icon="gear" label="Change, Edit, Manage Your Placer Account" title="Settings"
        maxWidth={760} />

      <div style={{ maxWidth: 760, margin: '0 auto', paddingBottom: 40 }}>
        {current ? (
          <>
            <Btn t={t} variant="ghost" size="sm" icon="chevLeft" onClick={() => setOpen(null)}
              style={{ marginLeft: -12, marginBottom: 12 }}>
              All settings
            </Btn>
            <h2 style={{ fontSize: 28, fontWeight: 700, color: t.ink, letterSpacing: '-0.02em', marginBottom: 24 }}>
              {current.title}
            </h2>
            {current.cards}
          </>
        ) : (
          categories.map((category) => (
            <Category key={category} t={t} title={category}>
              {Object.entries(options)
                .filter(([, option]) => option.category === category && option.show)
                .map(([key, option]) => (
                  <OptionRow key={key} t={t} icon={option.icon} title={option.title}
                    description={option.description} onClick={option.onSelect ?? (() => setOpen(key))} />
                ))}
            </Category>
          ))
        )}
      </div>
    </div>
  );
}

export default SettingsPage;
