/* PLACER — create or edit an organisation: its name, what it does, where it is, and
 * how to reach it. One page either way, and every field but the name optional. All of
 * it is shown on the organisation's public page. */

import { useState } from 'react';
import { Btn } from './UI';
import { createOrganisation, updateOrganisation } from '../services/organisations';

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
export function OrganisationSetupPage({ t, accountId, organisation = null, onSaved, onCancel }) {
  const editing = !!organisation;

  const [name, setName] = useState(organisation?.name ?? '');
  const [description, setDescription] = useState(organisation?.description ?? '');
  const [location, setLocation] = useState(organisation?.location ?? '');
  const [contactEmail, setContactEmail] = useState(organisation?.contactEmail ?? '');
  const [website, setWebsite] = useState(organisation?.website ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const complete = name.trim().length > 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!complete || saving) return;

    setSaving(true);
    setError(null);
    const fields = { name, description, location, contactEmail, website };
    try {
      const saved = editing
        ? await updateOrganisation(organisation.id, fields)
        : await createOrganisation({ createdBy: accountId, ...fields });
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
              ? 'Everything here is shown on the organisation’s public page.'
              : 'A page for a municipality, studio, association or any other group. You will be '
                + 'its first admin, you can add others, and projects can be run in its name. '
                + 'Everything here is shown on its public page.'}
          </p>
        </div>

        <Field t={t} label="Name *" htmlFor="organisation-name">
          <input id="organisation-name" type="text" value={name} maxLength={120}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Malmö Stad" style={inputStyle(t)} />
        </Field>

        <Field t={t} label="Description" htmlFor="organisation-description"
          hint="What the organisation is and does. Optional.">
          <textarea id="organisation-description" value={description} rows={5} maxLength={4000}
            onChange={(e) => setDescription(e.target.value)}
            style={{ ...inputStyle(t), resize: 'vertical' }} />
        </Field>

        <Field t={t} label="Location" htmlFor="organisation-location"
          hint="Where it is based. Optional.">
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
