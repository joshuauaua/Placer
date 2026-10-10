/* PLACER — create or edit an organisation: its name and profile picture, what it does,
 * where it is, how to reach it, and a cover image. One page either way, and every field but the name
 * optional. All of it is shown on the organisation's public page, except the exact
 * address, which places its pin on the Explore map instead. */

import { useEffect, useState } from 'react';
import { Avatar, Btn } from './UI';
import { ImagePicker } from './ImagePicker';
import {
  createOrganisation, removeOrganisationAvatarFile, removeOrganisationCoverFile, updateOrganisation,
  uploadOrganisationAvatar, uploadOrganisationCover,
} from '../services/organisations';
import { checkPickedImage } from '../services/media';
import { AddressInput } from './AddressInput';

// Matches ProjectSetupPage's form styling.
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

function Field({ t, label, htmlFor, hint, children }) {
  return (
    <div style={{ marginBottom: 26 }}>
      <label htmlFor={htmlFor}
        style={{ display: 'block', fontSize: 14, fontWeight: 700, color: t.ink, marginBottom: 8 }}>
        {label}
      </label>
      {hint && (
        <div style={{ fontSize: 13, color: t.inkDim, marginBottom: 10, lineHeight: 1.5 }}>{hint}</div>
      )}
      {children}
    </div>
  );
}

/**
 * `organisation` is null to create a new one, or an existing one (services/organisations'
 * fromRow shape) to edit it in place — the one form both `/organisations/new` and a
 * dashboard's "Edit details" reach.
 */
export function OrganisationSetupPage({ t, accountId, organisation: initialOrganisation = null, onSaved, onCancel }) {
  // Normally the organisation being edited. Creating one can set it too: if it is
  // created but its cover then fails to upload, the form carries on as an edit of it,
  // so trying again cannot create a second one — the same as ProjectSetupPage.
  const [organisation, setOrganisation] = useState(initialOrganisation);
  const editing = !!organisation;

  const [name, setName] = useState(organisation?.name ?? '');
  const [description, setDescription] = useState(organisation?.description ?? '');
  const [location, setLocation] = useState(organisation?.location ?? '');
  const [address, setAddress] = useState(organisation?.address ?? '');
  // Where `address` is, when it came from a suggestion; null once edited by hand.
  const [point, setPoint] = useState(organisation?.locationPoint ?? null);
  const [contactEmail, setContactEmail] = useState(organisation?.contactEmail ?? '');
  const [website, setWebsite] = useState(organisation?.website ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  // A new organisation has no id to name the pictures' folders until it is created, so
  // a picked file waits here, shown from a local preview, and is uploaded right after.
  const [pending, setPending] = useState(null); // the cover: { file, url } | null
  const [pendingAvatar, setPendingAvatar] = useState(null); // the profile picture, the same

  // A preview URL holds the file in memory until it is revoked.
  useEffect(() => () => { if (pending) URL.revokeObjectURL(pending.url); }, [pending]);
  useEffect(() => () => { if (pendingAvatar) URL.revokeObjectURL(pendingAvatar.url); }, [pendingAvatar]);

  // Editing: the cover saves straight away, like a profile cover in Settings, and the
  // file it replaces is deleted once the organisation points at the new one.
  const replaceCover = async (nextPath) => {
    const previous = organisation.coverPath;
    const saved = await updateOrganisation(organisation.id, { coverPath: nextPath });
    setOrganisation(saved);
    if (previous && previous !== nextPath) await removeOrganisationCoverFile(previous);
  };

  const pickPendingCover = async (file) => {
    checkPickedImage(file, 'A cover image'); // Throws the same sentence the upload would.
    setPending({ file, url: URL.createObjectURL(file) });
  };

  // The profile picture, the same way as the cover.
  const replaceAvatar = async (nextPath) => {
    const previous = organisation.avatarPath;
    const saved = await updateOrganisation(organisation.id, { avatarPath: nextPath });
    setOrganisation(saved);
    if (previous && previous !== nextPath) await removeOrganisationAvatarFile(previous);
  };

  const pickPendingAvatar = async (file) => {
    checkPickedImage(file, 'A profile picture');
    setPendingAvatar({ file, url: URL.createObjectURL(file) });
  };

  const shownCover = editing ? organisation.cover : pending?.url;
  const shownAvatar = editing ? organisation.avatar : pendingAvatar?.url;

  const complete = name.trim().length > 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!complete || saving) return;

    setSaving(true);
    setError(null);
    // No address, no point: clearing the address takes the pin off the map's exact spot.
    const fields = { name, description, location, address, contactEmail, website,
      locationPoint: address.trim() ? point : null };
    try {
      let saved = editing
        ? await updateOrganisation(organisation.id, fields)
        : await createOrganisation({ createdBy: accountId, ...fields });

      if (!editing && (pending || pendingAvatar)) {
        try {
          const pictures = {};
          if (pendingAvatar) pictures.avatarPath = await uploadOrganisationAvatar(saved.id, pendingAvatar.file);
          if (pending) pictures.coverPath = await uploadOrganisationCover(saved.id, pending.file);
          saved = await updateOrganisation(saved.id, pictures);
        } catch (pictureError) {
          console.error('Could not add the pictures:', pictureError);
          setOrganisation(saved);
          setPending(null);
          setPendingAvatar(null);
          setError(`The organisation was created, but its pictures could not be added: ${pictureError.message} `
            + 'Try them again below, or save without them.');
          setSaving(false);
          return;
        }
      }

      onSaved(saved);
    } catch (err) {
      console.error(`Could not ${editing ? 'save' : 'create'} that organisation:`, err);
      setError(err?.message ?? `Could not ${editing ? 'save' : 'create'} that organisation. Try again.`);
      setSaving(false);
    }
  };

  return (
    <div style={{ width: '100%', height: '100%', overflowY: 'auto', background: t.page,
      padding: '96px 40px' }} className="placer-scroll">
      <form onSubmit={handleSubmit} style={{ maxWidth: 640, margin: '0 auto' }}>
        <div style={{ marginBottom: 36 }}>
          <h1 className="placer-disp" style={{ fontSize: 40, fontWeight: 700, color: t.ink,
            letterSpacing: '-0.03em', marginBottom: 12, lineHeight: 1.1 }}>
            {editing ? 'Edit organisation' : 'Create an organisation'}
          </h1>
          <p style={{ fontSize: 16, color: t.inkDim, lineHeight: 1.6 }}>
            {editing
              ? 'Everything here but the exact address is shown on the organisation’s public '
                + 'page; the address places it on the Explore map.'
              : 'A page for a municipality, studio, association or any other group. You will be '
                + 'its first admin, you can add others, and projects can be run in its name. '
                + 'Everything here but the exact address is shown on its public page; the address '
                + 'places it on the Explore map.'}
          </p>
        </div>

        <Field t={t} label="Name *" htmlFor="organisation-name">
          <input id="organisation-name" type="text" value={name} maxLength={120}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Malmö Stad" style={inputStyle(t)} />
        </Field>

        <Field t={t} label="Profile picture"
          hint="The round picture beside the organisation's name — a logo works well. It is cropped to a square, resized to 512 pixels and saved without its location data; the file you pick can be up to 30 MB. Without one, its initials are shown. Optional.">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <Avatar name={name.trim() || 'Organisation'} size={72} photo={shownAvatar} />
            {editing ? (
              <ImagePicker t={t} hasImage={!!organisation.avatar} uploadLabel="Upload a picture"
                replaceLabel="Replace picture" removeLabel="Remove picture"
                onUpload={async (file) => replaceAvatar(await uploadOrganisationAvatar(organisation.id, file))}
                onRemove={() => replaceAvatar(null)} disabled={saving} />
            ) : (
              <ImagePicker t={t} hasImage={!!pendingAvatar} uploadLabel="Upload a picture"
                replaceLabel="Choose another picture" removeLabel="Remove picture" onUpload={pickPendingAvatar}
                onRemove={async () => setPendingAvatar(null)} disabled={saving} />
            )}
          </div>
        </Field>

        <Field t={t} label="Description" htmlFor="organisation-description"
          hint="What the organisation is and does. Optional.">
          <textarea id="organisation-description" value={description} rows={5} maxLength={4000}
            onChange={(e) => setDescription(e.target.value)}
            style={{ ...inputStyle(t), resize: 'vertical' }} />
        </Field>

        <Field t={t} label="Address" htmlFor="organisation-address"
          hint={'Where it is based, exactly. Pick the address from the suggestions and the organisation is pinned there on the Explore map, and its town and country fill in below. Optional.'}>
          <AddressInput id="organisation-address" value={address}
            placeholder="e.g. Malmöhusvägen 5, Malmö" style={inputStyle(t)}
            onChange={(next) => { setAddress(next); setPoint(null); }}
            onPick={(picked) => {
              setAddress(picked.address);
              setPoint(picked.point);
              if (picked.townAndCountry) setLocation(picked.townAndCountry);
            }} />
          {address.trim() && (
            <div style={{ fontSize: 13, color: t.inkFaint, marginTop: 8 }}>
              {point
                ? 'Pinned on the Explore map at this address.'
                : 'Not picked from the suggestions, so the map places it from the text as best it can.'}
            </div>
          )}
        </Field>

        <Field t={t} label="Town and country" htmlFor="organisation-location"
          hint="Shown on the public page. Filled in from the address; change it if it is not right. Optional.">
          <input id="organisation-location" type="text" value={location} maxLength={120}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Malmö, Sweden" style={inputStyle(t)} />
        </Field>

        <Field t={t} label="Contact email" htmlFor="organisation-contact-email"
          hint="An address people can reach the organisation at. Optional.">
          <input id="organisation-contact-email" type="email" value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            placeholder="e.g. hello@example.com" style={inputStyle(t)} />
        </Field>

        <Field t={t} label="Website" htmlFor="organisation-website" hint="Optional.">
          <input id="organisation-website" type="url" value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="e.g. example.com" style={inputStyle(t)} />
        </Field>

        <Field t={t} label="Cover image"
          hint="The wide picture across the top of the public page. A landscape photo works best. It is resized to at most 1920 pixels across and saved without its location data; the file you pick can be up to 30 MB, and the resized picture has to come to 3 MB or less. Optional.">
          <div style={{ height: 160, borderRadius: 12, marginBottom: 14, border: `1px solid ${t.line}`,
            background: shownCover ? `center / cover no-repeat url("${shownCover}")` : t.surfaceAlt,
            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {!shownCover && <span style={{ fontSize: 14, color: t.inkFaint }}>No cover yet</span>}
          </div>
          {editing ? (
            <ImagePicker t={t} hasImage={!!organisation.cover} uploadLabel="Upload a cover"
              replaceLabel="Replace cover"
              onUpload={async (file) => replaceCover(await uploadOrganisationCover(organisation.id, file))}
              onRemove={() => replaceCover(null)} disabled={saving} />
          ) : (
            <ImagePicker t={t} hasImage={!!pending} uploadLabel="Upload a cover"
              replaceLabel="Choose another" onUpload={pickPendingCover}
              onRemove={async () => setPending(null)} disabled={saving} />
          )}
        </Field>

        {error && (
          <div role="alert" style={{ marginBottom: 24, padding: 14, borderRadius: 12,
            background: '#F5F5F5', borderLeft: '4px solid #B3261E', fontSize: 14, color: t.ink, fontWeight: 500 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Btn t={t} type="submit" variant="primary" icon="check" disabled={!complete || saving}>
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Create organisation'}
          </Btn>
          {onCancel && (
            <Btn t={t} type="button" variant="ghost" onClick={onCancel}>Cancel</Btn>
          )}
        </div>
      </form>
    </div>
  );
}

export default OrganisationSetupPage;
