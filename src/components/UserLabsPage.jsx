/* PLACER — User Labs page
 *
 * A photo from a lab on one side, and the pitch with a way to apply on the
 * other (see PhotoSplit). Linked from the footer's Project column.
 *
 * Apply swaps the pitch for a short application form in the same column, rather
 * than a dialog, so the photo stays put and there is one thing on screen at a time.
 * Applications go through saveSurveyResponse into survey_responses under their own
 * `source` — that table is append-only for the anon key and takes any answers
 * shape, so a new kind of form needs no migration.
 */

import { useState } from 'react';

import userLabsPhoto from '../assets/user-labs.webp';
import { saveSurveyResponse } from '../services/api';
import { PhotoSplit, PhotoSplitHeading } from './PhotoSplit';

// If saving fails, the visitor can still apply the way they used to: by email, to
// the same address ContactPage.jsx shows.
const CONTACT_EMAIL = 'info@plcr.org';
const APPLY_MAILTO = `mailto:${CONTACT_EMAIL}?subject=User%20Labs%20application`;

const SOURCE = 'user_labs_application';

// One lab, run in both cities on the same day. The date is stored with each
// application so answers from later labs can be told apart.
const UPCOMING_LAB = {
  date: '2026-10-21',
  dateLabel: 'October 21',
  sessions: [
    { value: 'malmo', city: 'Malmö', time: '12:30 – 15:30' },
    { value: 'ankara', city: 'Ankara', time: '13:30 – 16:30' },
  ],
};

const EMPTY_FORM = { lab: '', name: '', email: '', phone: '', role: '', motivation: '', dietary: '', newsletter: false };

/** Matches the form inputs on the survey's contact step (placemakingSurvey/SurveyQuestion). */
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

const labelStyle = (t) => ({ display: 'block', fontSize: 14, fontWeight: 700, color: t.ink, marginBottom: 8 });

function UpcomingLab({ t }) {
  return (
    <div style={{ marginTop: 28 }}>
      <p style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.4, color: t.ink }}>
        Upcoming User Lab, {UPCOMING_LAB.dateLabel}
      </p>
      <p style={{ marginTop: 6, fontSize: 17, lineHeight: 1.65, color: t.inkDim }}>
        {UPCOMING_LAB.sessions.map((s) => `${s.city} ${s.time}`).join(' · ')}
      </p>
    </div>
  );
}

function Field({ t, id, label, hint, children }) {
  return (
    <div style={{ marginTop: 20 }}>
      <label htmlFor={id} style={labelStyle(t)}>
        {label}
        {hint && <span style={{ fontWeight: 400, color: t.inkDim }}> {hint}</span>}
      </label>
      {children}
    </div>
  );
}

function ApplicationForm({ t, onCancel, onSubmitted }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(false);

  const set = (key) => (e) => setForm((current) => ({ ...current, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSending(true);
    setError(false);
    try {
      await saveSurveyResponse({
        source: SOURCE,
        labDate: UPCOMING_LAB.date,
        lab: form.lab,
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        role: form.role.trim(),
        motivation: form.motivation.trim(),
        dietary: form.dietary.trim(),
        newsletter: form.newsletter,
      });
      onSubmitted(form);
    } catch {
      setError(true);
      setSending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: 8 }}>
      <fieldset style={{ border: 'none', padding: 0, margin: '20px 0 0' }}>
        <legend style={labelStyle(t)}>Which lab would you like to join?</legend>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
          {UPCOMING_LAB.sessions.map((session) => {
            const checked = form.lab === session.value;
            return (
              <label
                key={session.value}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', borderRadius: 12,
                  cursor: 'pointer', background: t.chrome,
                  border: `1.5px solid ${checked ? t.ink : t.line}`,
                }}
              >
                <input
                  type="radio"
                  name="user-labs-lab"
                  value={session.value}
                  checked={checked}
                  onChange={set('lab')}
                  required
                  style={{ marginTop: 3, accentColor: t.ink }}
                />
                <span>
                  <span style={{ display: 'block', fontSize: 15, fontWeight: 700, color: t.ink }}>{session.city}</span>
                  <span style={{ display: 'block', fontSize: 13.5, color: t.inkDim }}>
                    {UPCOMING_LAB.dateLabel}, {session.time}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <Field t={t} id="user-labs-name" label="Full name">
        <input id="user-labs-name" type="text" autoComplete="name" required
          value={form.name} onChange={set('name')} style={inputStyle(t)} />
      </Field>

      <Field t={t} id="user-labs-email" label="Email">
        <input id="user-labs-email" type="email" autoComplete="email" required
          value={form.email} onChange={set('email')} style={inputStyle(t)} />
      </Field>

      <Field t={t} id="user-labs-phone" label="Phone number" hint="(optional)">
        <input id="user-labs-phone" type="tel" autoComplete="tel"
          value={form.phone} onChange={set('phone')} style={inputStyle(t)} />
      </Field>

      <Field t={t} id="user-labs-role" label="What do you do?">
        <input id="user-labs-role" type="text" required
          placeholder="e.g. urban planner, architect, student, local resident"
          value={form.role} onChange={set('role')} style={inputStyle(t)} />
      </Field>

      <Field t={t} id="user-labs-motivation" label="What would you like to get out of the User Lab?">
        <textarea id="user-labs-motivation" rows={4} required maxLength={2000}
          placeholder="What draws you to it, and what you hope to take away"
          value={form.motivation} onChange={set('motivation')}
          style={{ ...inputStyle(t), resize: 'vertical', lineHeight: 1.5 }} />
      </Field>

      <Field t={t} id="user-labs-dietary" label="Food allergies or dietary preferences" hint="(optional)">
        <input id="user-labs-dietary" type="text"
          placeholder="e.g. vegetarian, nut allergy"
          value={form.dietary} onChange={set('dietary')} style={inputStyle(t)} />
      </Field>

      {/* Unticked by default: a newsletter sign-up has to be asked for, not assumed. */}
      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 24, cursor: 'pointer',
        fontSize: 15, lineHeight: 1.5, color: t.ink }}>
        <input
          type="checkbox"
          checked={form.newsletter}
          onChange={(e) => setForm((current) => ({ ...current, newsletter: e.target.checked }))}
          style={{ marginTop: 4, width: 16, height: 16, accentColor: t.ink }}
        />
        <span>Send me PLACER news and the newsletter</span>
      </label>

      {error && (
        <p role="alert" style={{ marginTop: 20, fontSize: 15, lineHeight: 1.6, color: t.ink }}>
          Sorry, your application could not be sent. Please try again, or email us at{' '}
          <a href={APPLY_MAILTO} style={{ color: t.ink }}>{CONTACT_EMAIL}</a>.
        </p>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
        <button
          type="submit"
          disabled={sending}
          className="placer-split-action"
          style={{ background: t.primaryBg, color: t.primaryFg, opacity: sending ? 0.6 : 1 }}
        >
          {sending ? 'Sending…' : 'Send application'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          style={{ marginTop: 32, background: 'none', border: 'none', padding: 0, cursor: 'pointer',
            fontSize: 15, fontWeight: 700, color: t.inkDim, fontFamily: 'var(--placer-font)' }}
        >
          Back
        </button>
      </div>

      <p style={{ marginTop: 20, fontSize: 13.5, lineHeight: 1.6, color: t.inkDim }}>
        We only use these details to organise the User Lab and get in touch with you about it.
        Food allergies and preferences are used only to cater for you, and deleted after the
        session.
      </p>
    </form>
  );
}

export function UserLabsPage({ t }) {
  // 'pitch' → 'form' → 'sent'
  const [step, setStep] = useState('pitch');
  const [sentTo, setSentTo] = useState(null);

  // Each step's heading, which a phone sets on the photo (see PhotoSplit).
  const HEADINGS = {
    pitch: <PhotoSplitHeading t={t} title="User Labs"
      subtitle="Help shape PLACER by testing it in the places you know." />,
    form: <PhotoSplitHeading t={t} title="Apply for a User Lab" />,
    sent: <PhotoSplitHeading t={t} title="Thank you for your interest" />,
  };

  return (
    <PhotoSplit
      t={t}
      src={userLabsPhoto}
      alt="A User Labs session outside an orange-red brick building: people pin notes to a map and sketch on wooden boards by a picnic table, beside a banner reading Designing Participatory Spaces."
      heading={HEADINGS[step]}
    >
      {step === 'pitch' && (
        <>
          <p style={{ marginTop: 20, fontSize: 17, lineHeight: 1.65, color: t.inkDim }}>
            User Labs are hands-on sessions where residents, designers and local leaders
            try PLACER out on real streets and squares. You sketch ideas, test early
            versions of the toolkit, and tell us what works and what does not, so what we
            build next comes from the people who will use it.
          </p>
          <UpcomingLab t={t} />
          <button
            type="button"
            onClick={() => setStep('form')}
            className="placer-split-action"
            style={{ background: t.primaryBg, color: t.primaryFg }}
          >
            Apply
          </button>
        </>
      )}

      {step === 'form' && (
        <>
          <ApplicationForm
            t={t}
            onCancel={() => setStep('pitch')}
            onSubmitted={(form) => { setSentTo(form); setStep('sent'); }}
          />
        </>
      )}

      {step === 'sent' && (
        <>
          <p style={{ marginTop: 20, fontSize: 17, lineHeight: 1.65, color: t.inkDim }}>
            Thanks for submitting your interest to take part in the User Lab in{' '}
            {UPCOMING_LAB.sessions.find((s) => s.value === sentTo?.lab)?.city}. We will confirm
            your spot by email to <strong style={{ color: t.ink }}>{sentTo?.email}</strong> by
            Thursday, October 8 at the latest.
          </p>
        </>
      )}
    </PhotoSplit>
  );
}

export default UserLabsPage;
