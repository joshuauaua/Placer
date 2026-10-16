/* PLACER — the Resources page's "Submit a case study" pop-up.
 *
 * A customer or partner tells us about a project they ran with PLACER, for the content
 * team to write up. Seven fields are required and marked with an asterisk; the
 * testimonial, the logo and the picture are optional. Sending files it with
 * services/caseStudySubmissions.js; with no Supabase project configured the same
 * button opens an email instead, so it is never a button that does nothing — the same
 * arrangement as the Toolkit's Contribute form.
 *
 * Pictures can only be attached by somebody signed in, since every upload goes through
 * the media function under an account's own folder. Signed out, the two file fields say
 * so instead of offering an upload that would be refused.
 */

import { useEffect, useRef, useState } from 'react';
import { Btn } from './UI';
import { Icon } from './Icon';
import {
  EMPTY_CASE_STUDY, INDUSTRIES, MAX_COMPANY_LENGTH, MAX_EMAIL_LENGTH, MAX_INDUSTRY_LENGTH,
  MAX_NAME_LENGTH, MAX_STORY_LENGTH, MAX_TESTIMONIAL_LENGTH, canAttachPictures,
  isSupabaseConfigured, submitCaseStudy, submitCaseStudyByEmailHref, validateCaseStudy,
} from '../services/caseStudySubmissions';

const ERROR_RED = '#B3261E';
const PICTURE_TYPES = 'image/jpeg,image/png,image/webp';

export function CaseStudyDialog({ t, signedIn = false, onClose }) {
  const [fields, setFields] = useState(EMPTY_CASE_STUDY);
  const [logo, setLogo] = useState(null);
  const [image, setImage] = useState(null);
  // 'idle' | 'sending' | 'sent' | 'error'
  const [status, setStatus] = useState('idle');
  // A sentence for the form as a whole (a refused insert, a failed upload), and one per
  // field that needs fixing, keyed by field name.
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const firstRef = useRef(null);
  const formRef = useRef(null);

  // Apart from the Escape handler below, so a parent re-render handing in a new
  // onClose does not pull focus back to the first field mid-sentence.
  useEffect(() => { firstRef.current?.focus(); }, []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const configured = isSupabaseConfigured();
  const attachable = configured && canAttachPictures() && signedIn;

  const set = (key) => (e) => {
    const { value } = e.target;
    setFields((current) => ({ ...current, [key]: value }));
    // Once a field has been flagged, re-check it as it is typed into, so the message
    // goes away as soon as it is fixed rather than on the next submit.
    if (fieldErrors[key] || (key === 'industry' && fieldErrors.otherIndustry)) {
      const next = validateCaseStudy({ ...fields, [key]: value }) ?? {};
      setFieldErrors((current) => {
        const updated = { ...current };
        for (const name of [key, ...(key === 'industry' ? ['otherIndustry'] : [])]) {
          if (next[name]) updated[name] = next[name];
          else delete updated[name];
        }
        return updated;
      });
    }
  };

  const send = async (e) => {
    e.preventDefault();
    if (status === 'sending') return;
    const problems = validateCaseStudy(fields);
    if (problems) {
      setFieldErrors(problems);
      setError('Some required fields need fixing — see the messages below each one.');
      setStatus('error');
      // Take somebody to the first field that needs them.
      const first = Object.keys(problems)[0];
      formRef.current?.querySelector(`[name="${first}"]`)?.focus();
      return;
    }
    setFieldErrors({});
    if (!configured) {
      window.location.href = submitCaseStudyByEmailHref(fields);
      return;
    }
    setStatus('sending');
    setError('');
    try {
      await submitCaseStudy(fields, attachable ? { logo, image } : {});
      setFields(EMPTY_CASE_STUDY);
      setLogo(null);
      setImage(null);
      setStatus('sent');
    } catch (err) {
      setError(err.message);
      setStatus('error');
    }
  };

  const labelStyle = { display: 'block', fontSize: 14, fontWeight: 500, color: t.ink, marginBottom: 6 };
  const inputStyle = (name) => ({
    width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 9,
    border: `1.5px solid ${fieldErrors[name] ? ERROR_RED : t.lineStrong}`, background: t.surfaceAlt,
    color: t.ink, fontFamily: 'var(--placer-font)', fontSize: 15, lineHeight: 1.5,
  });
  const hint = { fontSize: 13, color: t.inkDim, margin: '-2px 0 8px', lineHeight: 1.5 };

  // A labelled field: the label (with an asterisk when required), an optional hint,
  // the control, and its error underneath. `control` gets the ids and aria wiring.
  const field = (name, label, control, { required = false, help } = {}) => {
    const id = `placer-case-study-${name}`;
    const errorId = `${id}-error`;
    const helpId = help ? `${id}-help` : undefined;
    const describedBy = [helpId, fieldErrors[name] ? errorId : null].filter(Boolean).join(' ') || undefined;
    return (
      <div style={{ marginBottom: 16 }}>
        <label htmlFor={id} style={labelStyle}>
          {label}
          {required
            ? <span aria-hidden="true" style={{ color: ERROR_RED }}> *</span>
            : <span style={{ color: t.inkDim, fontWeight: 400 }}> (optional)</span>}
        </label>
        {help && <p id={helpId} style={hint}>{help}</p>}
        {control({ id, name, required, 'aria-invalid': fieldErrors[name] ? true : undefined,
          'aria-describedby': describedBy, style: inputStyle(name) })}
        {fieldErrors[name] && (
          <p id={errorId} style={{ fontSize: 13, color: ERROR_RED, margin: '6px 0 0' }}>{fieldErrors[name]}</p>
        )}
      </div>
    );
  };

  const text = (name, label, max, opts = {}) => field(name, label, (props) => (
    <input {...props} ref={opts.inputRef} type={opts.type ?? 'text'} autoComplete={opts.autoComplete}
      value={fields[name]} onChange={set(name)} maxLength={max} />
  ), opts);

  const area = (name, label, max, opts = {}) => field(name, label, (props) => (
    <textarea {...props} rows={opts.rows ?? 4} value={fields[name]} onChange={set(name)} maxLength={max}
      placeholder={opts.placeholder} style={{ ...props.style, resize: 'vertical' }} />
  ), opts);

  const picture = (name, label, file, setFile, help) => {
    const id = `placer-case-study-${name}`;
    return (
      <div style={{ marginBottom: 16 }}>
        <label htmlFor={attachable ? id : undefined} style={labelStyle}>
          {label}<span style={{ color: t.inkDim, fontWeight: 400 }}> (optional)</span>
        </label>
        {!attachable ? (
          <p style={{ ...hint, margin: 0 }}>
            {configured && canAttachPictures()
              ? 'Sign in before you start to attach one — or send it to us by email once we reply.'
              : 'Send it to us by email once we reply.'}
          </p>
        ) : (
          <>
            <p style={hint}>{help}</p>
            {file ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: t.ink }}>
                <Icon name="image" size={16} stroke={2} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
                <button type="button" onClick={() => setFile(null)} aria-label={`Remove ${label.toLowerCase()}`}
                  style={{ background: 'none', border: 0, padding: 4, cursor: 'pointer', color: t.inkDim }}>
                  <Icon name="close" size={16} stroke={2} />
                </button>
              </div>
            ) : (
              <input id={id} name={name} type="file" accept={PICTURE_TYPES}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                style={{ fontFamily: 'var(--placer-font)', fontSize: 14, color: t.ink }} />
            )}
          </>
        )}
      </div>
    );
  };

  return (
    // The backdrop closes the dialog; clicks inside it stop before they reach it.
    <div onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(17,17,17,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div role="dialog" aria-modal="true" aria-labelledby="placer-case-study-title"
        onClick={(e) => e.stopPropagation()}
        style={{ width: 640, maxWidth: '100%', maxHeight: '100%', overflowY: 'auto',
          background: t.surface, color: t.ink, border: `1px solid ${t.line}`, borderRadius: 16,
          boxShadow: t.shadow, padding: 28, boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
          marginBottom: 8 }}>
          <h2 id="placer-case-study-title" className="placer-disp"
            style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.01em', margin: 0 }}>
            Submit a case study
          </h2>
          <button type="button" onClick={onClose} aria-label="Close"
            style={{ background: 'none', border: 0, padding: 4, cursor: 'pointer', color: t.inkDim }}>
            <Icon name="close" size={20} stroke={2} />
          </button>
        </div>

        {status === 'sent' ? (
          <div role="status">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '12px 0 8px' }}>
              <Icon name="check" size={22} stroke={2.4} />
              <p style={{ fontSize: 17, fontWeight: 600, margin: 0 }}>Thank you — your case study is in.</p>
            </div>
            <p style={{ fontSize: 15, color: t.inkDim, lineHeight: 1.6, margin: '0 0 20px' }}>
              Our content team will read it and get in touch at the email address you gave
              before anything is published.
            </p>
            <Btn t={t} size="sm" variant="outline" onClick={onClose}>Close</Btn>
          </div>
        ) : (
          <form ref={formRef} onSubmit={send} noValidate>
            <p style={{ fontSize: 15, color: t.inkDim, lineHeight: 1.6, margin: '0 0 8px' }}>
              Used PLACER on a project? Tell us how it went, and we may feature it in our
              Resources.
            </p>
            <p style={{ fontSize: 13, color: t.inkDim, margin: '0 0 20px' }}>
              Fields marked <span style={{ color: ERROR_RED }}>*</span> are required.
            </p>

            {text('company', 'Company name', MAX_COMPANY_LENGTH,
              { required: true, inputRef: firstRef, autoComplete: 'organization' })}

            {field('industry', 'Industry', (props) => (
              <select {...props} value={fields.industry} onChange={set('industry')}>
                <option value="" disabled>Choose an industry</option>
                {INDUSTRIES.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            ), { required: true })}
            {fields.industry === 'Other'
              && text('otherIndustry', 'Your industry', MAX_INDUSTRY_LENGTH, { required: true })}

            {area('problem', 'Problem faced', MAX_STORY_LENGTH,
              { required: true, placeholder: 'What were you trying to solve, and for whom?' })}
            {area('solution', 'Solution provided', MAX_STORY_LENGTH,
              { required: true, placeholder: 'How did you use PLACER? Which tools, with which people?' })}
            {area('results', 'Results / impact', MAX_STORY_LENGTH,
              { required: true, help: 'Numbers help: people reached, ideas gathered, decisions made, time saved.' })}
            {area('testimonial', 'Testimonial quote', MAX_TESTIMONIAL_LENGTH,
              { rows: 3, placeholder: 'A sentence or two we may quote, with who said it.' })}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', columnGap: 16 }}>
              {text('contactName', 'Client contact name', MAX_NAME_LENGTH,
                { required: true, autoComplete: 'name' })}
              {text('contactEmail', 'Client contact email', MAX_EMAIL_LENGTH,
                { required: true, type: 'email', autoComplete: 'email' })}
            </div>

            {picture('logo', 'Client logo', logo, setLogo, 'A JPEG, PNG or WebP.')}
            {picture('image', 'Case study image or screenshot', image, setImage,
              'A JPEG, PNG or WebP — a photo of the place or a screenshot of the project.')}

            {status === 'error' && error && (
              <p role="alert" style={{ fontSize: 13.5, color: ERROR_RED, margin: '12px 0 0' }}>{error}</p>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 24 }}>
              <Btn t={t} size="sm" variant="ghost" type="button" onClick={onClose}>Cancel</Btn>
              <Btn t={t} size="sm" variant="primary" type="submit" icon="send"
                disabled={status === 'sending'}>
                {status === 'sending' ? 'Sending…' : configured ? 'Submit' : 'Submit by email'}
              </Btn>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default CaseStudyDialog;
