/* PLACER — Add a case study, at /add-a-case-study.
 *
 * Reached from the landing page's "Add a case study" band. It is for the people we
 * have invited to write one up, so it opens on a code (lib/caseStudy.js); once it is
 * entered the form stays open for the visit.
 *
 * The form walks through the project in seven numbered parts: what and where, its
 * pictures, the story, the funding, the people and organisations behind it, links,
 * and who is sending it. Pictures are shrunk on the device as they are chosen
 * (lib/pictureEncode.js). It is saved like every other form on this site, into
 * survey_responses under its own source, and nothing is published before the team has
 * read it and been in touch.
 *
 * There are no accounts on this site yet. Organisations and team members are named,
 * with an email each where it is known, so they can be invited to a PLACER account and
 * linked to the case study once accounts open.
 */

import { useRef, useState } from 'react';
import { useLocation } from 'wouter';
import posthog from 'posthog-js';

import { saveSurveyResponse } from '../services/api';
import { pictureToDataUrl } from '../lib/pictureEncode';
import {
  CASE_STUDY_SOURCE, EMPTY_CASE_STUDY, FUNDING_OPTIONS, MAX_OTHER_IMAGES, MAX_ROWS, MAX_SHORT, MAX_STORY,
  MAX_SUBTITLE, MAX_TITLE, UNLOCK_KEY, caseStudyResponse, codeMatches, emptyLink, emptyMember,
  emptyOrganisation, validateCaseStudy,
} from '../lib/caseStudy';
import { Icon } from './Icon';

const CONTACT_EMAIL = 'info@plcr.org';
const PICTURE_TYPES = 'image/jpeg,image/png,image/webp,image/heic';

function wasUnlocked() {
  try {
    return sessionStorage.getItem(UNLOCK_KEY) === 'yes';
  } catch {
    return false;
  }
}

/** The code, before the form. */
function CodeGate({ onUnlock }) {
  const [code, setCode] = useState('');
  const [status, setStatus] = useState('idle'); // idle | checking | wrong

  const submit = async (e) => {
    e.preventDefault();
    setStatus('checking');
    if (await codeMatches(code)) {
      try { sessionStorage.setItem(UNLOCK_KEY, 'yes'); } catch { /* private mode: asked again next visit */ }
      posthog.capture('survey_started', { source: CASE_STUDY_SOURCE });
      onUnlock();
    } else {
      setStatus('wrong');
    }
  };

  return (
    <form className="placer-case-gate" onSubmit={submit}>
      <h2 className="placer-case-gate-title">Enter your case study code</h2>
      <p className="placer-case-gate-text">
        The form is open to the projects we have invited for now. Enter the code from your invitation to start.
        Don&rsquo;t have one? Write to us at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
      <label htmlFor="placer-case-code" className="placer-case-label">Code</label>
      <div className="placer-case-gate-row">
        <input id="placer-case-code" className="placer-case-input" type="text" autoComplete="off"
          spellCheck={false} value={code} onChange={(e) => { setCode(e.target.value); setStatus('idle'); }}
          aria-invalid={status === 'wrong' || undefined}
          aria-describedby={status === 'wrong' ? 'placer-case-code-error' : undefined} />
        <button type="submit" className="placer-case-primary" disabled={!code.trim() || status === 'checking'}>
          Open the form
        </button>
      </div>
      {status === 'wrong' && (
        <p id="placer-case-code-error" role="alert" className="placer-case-error">
          That code is not right. Check it against your invitation and try again.
        </p>
      )}
    </form>
  );
}

/** A numbered part of the form, with what it is for. */
function Part({ n, title, intro, children }) {
  return (
    <fieldset className="placer-case-part">
      <legend className="placer-case-part-title">
        <span className="placer-case-part-number" aria-hidden="true">{n}</span>
        {title}
      </legend>
      {intro && <p className="placer-case-part-intro">{intro}</p>}
      {children}
    </fieldset>
  );
}

/** A label, an optional hint, the control and its error. The control gets the wiring. */
function Field({ id, label, required = false, hint, error, children }) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className="placer-case-field">
      <label htmlFor={id} className="placer-case-label">
        {label}
        {required ? <span className="placer-case-required" aria-hidden="true"> *</span>
          : <span className="placer-case-optional"> (optional)</span>}
      </label>
      {hint && <p id={hintId} className="placer-case-hint">{hint}</p>}
      {children({ id, 'aria-describedby': [hintId, errorId].filter(Boolean).join(' ') || undefined,
        'aria-invalid': error ? true : undefined, required })}
      {error && <p id={errorId} className="placer-case-error">{error}</p>}
    </div>
  );
}

/** A repeatable list of rows, each a few short fields, with Add and Remove. */
function RowList({ name, rows, columns, emptyRow, addLabel, errors, onChange }) {
  const update = (index, key, value) => onChange(rows.map((row, i) => (i === index ? { ...row, [key]: value } : row)));
  return (
    <div className="placer-case-rows">
      {rows.map((row, index) => (
        <div key={index} className="placer-case-row" role="group" aria-label={`${addLabel.replace(/^Add (an? )?/, '')} ${index + 1}`}>
          {columns.map((column) => {
            const id = `placer-case-${name}-${index}-${column.key}`;
            const error = errors[`${name}.${index}.${column.key}`];
            return (
              <div key={column.key} className="placer-case-row-cell">
                <label htmlFor={id} className="placer-case-row-label">{column.label}</label>
                <input id={id} className="placer-case-input" type={column.type ?? 'text'} value={row[column.key]}
                  placeholder={column.placeholder} maxLength={MAX_SHORT} aria-invalid={error ? true : undefined}
                  onChange={(e) => update(index, column.key, e.target.value)} />
                {error && <p className="placer-case-error">{error}</p>}
              </div>
            );
          })}
          <button type="button" className="placer-case-remove" aria-label={`Remove ${index + 1}`}
            onClick={() => onChange(rows.filter((_, i) => i !== index))}>
            <Icon name="close" size={18} stroke={2} />
          </button>
        </div>
      ))}
      {rows.length < MAX_ROWS && (
        <button type="button" className="placer-case-add" onClick={() => onChange([...rows, emptyRow()])}>
          <Icon name="plus" size={16} stroke={2.2} />{addLabel}
        </button>
      )}
    </div>
  );
}

function CaseStudyForm({ onSent }) {
  const [fields, setFields] = useState(EMPTY_CASE_STUDY);
  const [hero, setHero] = useState(null); // { name, url }
  const [images, setImages] = useState([]); // [{ name, url }]
  const [preparing, setPreparing] = useState(false);
  const [pictureError, setPictureError] = useState('');
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState('idle'); // idle | sending | error

  const set = (key) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFields((current) => ({ ...current, [key]: value }));
    if (errors[key]) setErrors(({ [key]: _gone, ...rest }) => rest);
  };
  const setList = (key) => (rows) => setFields((current) => ({ ...current, [key]: rows }));

  const prepare = async (files, maxSide) => {
    setPreparing(true);
    setPictureError('');
    try {
      return await Promise.all(files.map(async (file) => ({ name: file.name, url: await pictureToDataUrl(file, { maxSide }) })));
    } catch (err) {
      setPictureError(err.message);
      return [];
    } finally {
      setPreparing(false);
    }
  };

  const chooseHero = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const [picture] = await prepare([file], 1600);
    if (picture) {
      setHero(picture);
      setErrors(({ hero: _gone, ...rest }) => rest);
    }
  };

  const chooseImages = async (e) => {
    const files = Array.from(e.target.files ?? []).slice(0, MAX_OTHER_IMAGES - images.length);
    e.target.value = '';
    if (files.length === 0) return;
    const pictures = await prepare(files, 1200);
    setImages((current) => [...current, ...pictures].slice(0, MAX_OTHER_IMAGES));
  };

  const send = async (e) => {
    e.preventDefault();
    const problems = validateCaseStudy(fields, { hero });
    if (problems) {
      setErrors(problems);
      setStatus('idle');
      // To the first thing that needs fixing.
      const first = Object.keys(problems)[0].replaceAll('.', '-');
      document.getElementById(`placer-case-${first}`)?.focus();
      return;
    }
    setErrors({});
    setStatus('sending');
    try {
      await saveSurveyResponse(caseStudyResponse(fields, { hero: hero.url, images: images.map((image) => image.url) }));
      // Choices only: nothing typed goes to PostHog.
      posthog.capture('survey_submitted', {
        source: CASE_STUDY_SOURCE, funded: fields.funded, images: images.length,
        organisations: fields.organisations.length, members: fields.members.length,
      });
      onSent(fields.contactEmail.trim());
    } catch (err) {
      console.error('Could not send the case study:', err);
      setStatus('error');
    }
  };

  const errorCount = Object.keys(errors).length;

  return (
    <form className="placer-case-form-body" onSubmit={send} noValidate>
      <p className="placer-case-legend-note">
        Fields marked <span className="placer-case-required">*</span> are required. It takes about 15 minutes.
      </p>

      <Part n={1} title="The project" intro="What it was, where, and when. This is the first thing people read.">
        <Field id="placer-case-title" label="Title" required error={errors.title}
          hint="The name of the project, or a headline for it.">
          {(props) => <input {...props} className="placer-case-input" type="text" maxLength={MAX_TITLE}
            placeholder="e.g. Folkets Park, redesigned with its neighbours" value={fields.title} onChange={set('title')} />}
        </Field>
        <Field id="placer-case-subtitle" label="Short description" required error={errors.subtitle}
          hint="One or two sentences, shown under the title on the case study card.">
          {(props) => <textarea {...props} className="placer-case-input" rows={2} maxLength={MAX_SUBTITLE}
            value={fields.subtitle} onChange={set('subtitle')} />}
        </Field>
        <Field id="placer-case-place" label="Where" required error={errors.place} hint="The city and country.">
          {(props) => <input {...props} className="placer-case-input" type="text" maxLength={MAX_SHORT}
            placeholder="e.g. Malmö, Sweden" value={fields.place} onChange={set('place')} />}
        </Field>
        <div className="placer-case-pair">
          <Field id="placer-case-startDate" label="Started" required error={errors.startDate}>
            {(props) => <input {...props} className="placer-case-input" type="month" placeholder="YYYY-MM" value={fields.startDate}
              onChange={set('startDate')} />}
          </Field>
          <Field id="placer-case-endDate" label="Ended" error={errors.endDate}>
            {(props) => <input {...props} className="placer-case-input" type="month" placeholder="YYYY-MM" value={fields.endDate}
              disabled={fields.ongoing} onChange={set('endDate')} />}
          </Field>
        </div>
        <label className="placer-case-check">
          <input type="checkbox" checked={fields.ongoing} onChange={set('ongoing')} />
          <span>It is still going on</span>
        </label>
      </Part>

      <Part n={2} title="Pictures"
        intro="A header picture for the top of the page, and up to six more. Only send pictures you have permission to share.">
        <div className="placer-case-field">
          <span className="placer-case-label" id="placer-case-hero-label">
            Header picture<span className="placer-case-required" aria-hidden="true"> *</span>
          </span>
          <p className="placer-case-hint">A wide photo of the place works best: landscape, at least 1600 pixels across.</p>
          {hero ? (
            <div className="placer-case-hero-preview">
              <img src={hero.url} alt={`Header picture: ${hero.name}`} />
              <button type="button" className="placer-case-secondary" onClick={() => setHero(null)}>Choose another</button>
            </div>
          ) : (
            <label className="placer-case-drop" htmlFor="placer-case-hero">
              <Icon name="image" size={22} stroke={2} />
              <span>{preparing ? 'Preparing the picture…' : 'Choose a header picture'}</span>
              <input id="placer-case-hero" type="file" accept={PICTURE_TYPES} onChange={chooseHero}
                aria-labelledby="placer-case-hero-label" aria-invalid={errors.hero ? true : undefined}
                className="placer-case-file" />
            </label>
          )}
          {errors.hero && <p className="placer-case-error">{errors.hero}</p>}
        </div>

        <div className="placer-case-field">
          <span className="placer-case-label" id="placer-case-images-label">
            Other pictures<span className="placer-case-optional"> (optional, up to {MAX_OTHER_IMAGES})</span>
          </span>
          <p className="placer-case-hint">The process, the people taking part, and the place before and after.</p>
          {images.length > 0 && (
            <ul className="placer-case-thumbs">
              {images.map((image, index) => (
                <li key={`${image.name}-${index}`}>
                  <img src={image.url} alt={image.name} />
                  <button type="button" aria-label={`Remove ${image.name}`}
                    onClick={() => setImages((current) => current.filter((_, i) => i !== index))}>
                    <Icon name="close" size={14} stroke={2.4} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {images.length < MAX_OTHER_IMAGES && (
            <label className="placer-case-drop placer-case-drop-small" htmlFor="placer-case-images">
              <Icon name="plus" size={18} stroke={2} />
              <span>{preparing ? 'Preparing…' : 'Add pictures'}</span>
              <input id="placer-case-images" type="file" accept={PICTURE_TYPES} multiple onChange={chooseImages}
                aria-labelledby="placer-case-images-label" className="placer-case-file" />
            </label>
          )}
        </div>
        {pictureError && <p role="alert" className="placer-case-error">{pictureError}</p>}
      </Part>

      <Part n={3} title="The story" intro="In your own words. Short paragraphs are fine; we will edit with you before anything is published.">
        <Field id="placer-case-need" label="What need did it address?" required error={errors.need}
          hint="The problem or the opportunity, and why it mattered to the people there.">
          {(props) => <textarea {...props} className="placer-case-input" rows={4} maxLength={MAX_STORY}
            value={fields.need} onChange={set('need')} />}
        </Field>
        <Field id="placer-case-approach" label="What did you do?" required error={errors.approach}
          hint="How people took part: the activities, the tools, how many sessions, on site or online.">
          {(props) => <textarea {...props} className="placer-case-input" rows={4} maxLength={MAX_STORY}
            value={fields.approach} onChange={set('approach')} />}
        </Field>
        <Field id="placer-case-audience" label="Who was it for?" required error={errors.audience}
          hint="The people who took part and the people it serves: residents, a school, traders, a district.">
          {(props) => <textarea {...props} className="placer-case-input" rows={3} maxLength={MAX_STORY}
            value={fields.audience} onChange={set('audience')} />}
        </Field>
        <Field id="placer-case-outcome" label="What came of it?" error={errors.outcome}
          hint="What changed, what was decided or built, and what you learnt. Numbers help: people reached, ideas gathered.">
          {(props) => <textarea {...props} className="placer-case-input" rows={4} maxLength={MAX_STORY}
            value={fields.outcome} onChange={set('outcome')} />}
        </Field>
      </Part>

      <Part n={4} title="Funding">
        <div className="placer-case-field" role="radiogroup" aria-labelledby="placer-case-funded-label"
          aria-describedby={errors.funded ? 'placer-case-funded-error' : undefined}>
          <span id="placer-case-funded-label" className="placer-case-label">
            Was it funded?<span className="placer-case-required" aria-hidden="true"> *</span>
          </span>
          <div className="placer-case-choices">
            {FUNDING_OPTIONS.map((option, index) => (
              <label key={option.value} className="placer-case-choice" data-checked={fields.funded === option.value}>
                <input type="radio" name="placer-case-funded" value={option.value}
                  id={index === 0 ? 'placer-case-funded' : undefined}
                  checked={fields.funded === option.value} onChange={set('funded')} />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
          {errors.funded && <p id="placer-case-funded-error" className="placer-case-error">{errors.funded}</p>}
        </div>
        {fields.funded === 'yes' && (
          <div className="placer-case-pair">
            <Field id="placer-case-funder" label="By whom?" required error={errors.funder}
              hint="The funder, grant or programme.">
              {(props) => <input {...props} className="placer-case-input" type="text" maxLength={MAX_SHORT}
                placeholder="e.g. Swedish Institute" value={fields.funder} onChange={set('funder')} />}
            </Field>
            <Field id="placer-case-amount" label="How much?" hint="With the currency.">
              {(props) => <input {...props} className="placer-case-input" type="text" maxLength={MAX_SHORT}
                placeholder="e.g. 250 000 SEK" value={fields.amount} onChange={set('amount')} />}
            </Field>
          </div>
        )}
      </Part>

      <Part n={5} title="People and organisations"
        intro="Who led it, who it was done with, and who was on the team.">
        <div className="placer-case-note">
          <Icon name="user" size={18} stroke={2} />
          <p>
            To link the case study to an organisation or a person on PLACER, they need a PLACER account.
            Accounts are not open yet: add an email for each where you can, and we will invite them to make
            one and link them to the case study when they are.
          </p>
        </div>
        <Field id="placer-case-organisationName" label="Organisation that led it" required error={errors.organisationName}>
          {(props) => <input {...props} className="placer-case-input" type="text" maxLength={MAX_SHORT}
            autoComplete="organization" value={fields.organisationName} onChange={set('organisationName')} />}
        </Field>
        <label className="placer-case-check">
          <input type="checkbox" checked={fields.organisationAccount} onChange={set('organisationAccount')} />
          <span>Set up a PLACER organisation account for it, so the case study can be shown on its page</span>
        </label>

        <div className="placer-case-field">
          <span className="placer-case-label">
            Partner organisations and institutions<span className="placer-case-optional"> (optional)</span>
          </span>
          <p className="placer-case-hint">A municipality, a university, a community group, a funder.</p>
          <RowList name="organisations" rows={fields.organisations} emptyRow={emptyOrganisation}
            addLabel="Add an organisation" errors={errors} onChange={setList('organisations')}
            columns={[
              { key: 'name', label: 'Name' },
              { key: 'role', label: 'Their part', placeholder: 'e.g. commissioned it' },
              { key: 'email', label: 'Contact email', type: 'email' },
            ]} />
        </div>

        <div className="placer-case-field">
          <span className="placer-case-label">Team members<span className="placer-case-optional"> (optional)</span></span>
          <p className="placer-case-hint">The people who ran it, so they can be credited.</p>
          <RowList name="members" rows={fields.members} emptyRow={emptyMember}
            addLabel="Add a team member" errors={errors} onChange={setList('members')}
            columns={[
              { key: 'name', label: 'Name' },
              { key: 'role', label: 'Role', placeholder: 'e.g. lead designer' },
              { key: 'email', label: 'Email', type: 'email' },
            ]} />
        </div>
      </Part>

      <Part n={6} title="Links" intro="Where to find out more: a project page, a report, press, a video.">
        <RowList name="links" rows={fields.links} emptyRow={emptyLink} addLabel="Add a link" errors={errors}
          onChange={setList('links')}
          columns={[
            { key: 'label', label: 'What it is', placeholder: 'e.g. Final report' },
            { key: 'url', label: 'Web address', type: 'url', placeholder: 'https://' },
          ]} />
      </Part>

      <Part n={7} title="About you" intro="So we can get back to you about it. We will not publish your email.">
        <div className="placer-case-pair">
          <Field id="placer-case-contactName" label="Your name" required error={errors.contactName}>
            {(props) => <input {...props} className="placer-case-input" type="text" autoComplete="name"
              maxLength={MAX_SHORT} value={fields.contactName} onChange={set('contactName')} />}
          </Field>
          <Field id="placer-case-contactEmail" label="Your email" required error={errors.contactEmail}>
            {(props) => <input {...props} className="placer-case-input" type="email" autoComplete="email"
              maxLength={MAX_SHORT} value={fields.contactEmail} onChange={set('contactEmail')} />}
          </Field>
        </div>
        <Field id="placer-case-contactRole" label="Your role in the project">
          {(props) => <input {...props} className="placer-case-input" type="text" maxLength={MAX_SHORT}
            value={fields.contactRole} onChange={set('contactRole')} />}
        </Field>
        <label className="placer-case-check">
          <input id="placer-case-consent" type="checkbox" checked={fields.consent} onChange={set('consent')}
            aria-invalid={errors.consent ? true : undefined} />
          <span>
            I may share these details and pictures, and PLACER may publish them as a case study once we have
            agreed the final text.<span className="placer-case-required" aria-hidden="true"> *</span>
          </span>
        </label>
        {errors.consent && <p className="placer-case-error">{errors.consent}</p>}
      </Part>

      {errorCount > 0 && (
        <p role="alert" className="placer-case-summary-error">
          {errorCount === 1 ? 'One thing needs' : `${errorCount} things need`} fixing before it can be sent:
          see the messages in red.
        </p>
      )}
      {status === 'error' && (
        <p role="alert" className="placer-case-summary-error">
          It did not go through. Please try again, or email it to us at{' '}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      )}

      <div className="placer-case-actions">
        <button type="submit" className="placer-case-primary" disabled={status === 'sending' || preparing}>
          {status === 'sending' ? 'Sending…' : 'Send the case study'}
        </button>
      </div>
    </form>
  );
}

export function CaseStudyPage() {
  const [, navigate] = useLocation();
  const [step, setStep] = useState(() => (wasUnlocked() ? 'form' : 'locked')); // locked | form | sent
  const [sentTo, setSentTo] = useState('');
  const topRef = useRef(null);

  return (
    <div className="placer-case" ref={topRef}>
      <header className="placer-case-header">
        <p className="placer-case-eyebrow">Case studies</p>
        <h1 className="placer-case-title">{step === 'sent' ? 'Thank you.' : 'Add a case study'}</h1>
        {step !== 'sent' && (
          <p className="placer-case-intro">
            Tell us about a project where people helped shape a place. We will read it, get in touch to agree the
            text with you, and publish it among PLACER&rsquo;s case studies.
          </p>
        )}
      </header>

      {step === 'locked' && <CodeGate onUnlock={() => setStep('form')} />}

      {step === 'form' && (
        <CaseStudyForm onSent={(email) => {
          setSentTo(email);
          setStep('sent');
          // The form is long, so the thanks would otherwise be far above the screen.
          topRef.current?.scrollIntoView?.({ block: 'start' });
        }} />
      )}

      {step === 'sent' && (
        <div className="placer-case-sent" role="status">
          <p>
            Your case study is with us. We will read it and write to <strong>{sentTo}</strong> before anything is
            published.
          </p>
          <div className="placer-case-actions">
            <button type="button" className="placer-case-secondary" onClick={() => navigate('/')}>Back to the home page</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default CaseStudyPage;
