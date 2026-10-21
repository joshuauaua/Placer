import { describe, it, expect, vi, beforeEach, afterEach } from 'vite-plus/test';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Router } from 'wouter';
import { memoryLocation } from 'wouter/memory-location';
import { THEME } from '../../theme';
import { photoUploads } from '../../lib/responsiveImage';

const insert = vi.fn();
const from = vi.fn(() => ({ insert }));
const getSession = vi.fn();
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ from, auth: { getSession } }) }));

const uploadMedia = vi.fn(async (_supabase, path) => path);
vi.mock('../../services/media', async (importOriginal) => ({
  ...(await importOriginal()),
  preparePhoto: vi.fn(async () => ({ blob: new Blob(['x']), ext: 'webp' })),
  uploadMedia: (...args) => uploadMedia(...args),
  uploadPhoto: async (supabase, base, photo) => {
    let path = null;
    for (const each of photoUploads(base, photo)) path = await uploadMedia(supabase, each.path, each.blob);
    return path;
  },
}));

import { CaseStudyDialog } from '../CaseStudyDialog';
import { ResourcesPage } from '../ResourcesPage';
import {
  cleanCaseStudy, submitCaseStudyByEmailHref, validateCaseStudy,
} from '../../services/caseStudySubmissions';

const COMPLETE = {
  company: 'Malmö Stad', industry: 'Local government', otherIndustry: '',
  problem: 'Nobody came to consultations.', solution: 'We ran a Desire Lines walk.',
  results: '300 people took part, four times the usual.', testimonial: '',
  contactName: 'Ana Lind', contactEmail: 'ana@example.org',
};

const fill = (overrides = {}) => {
  const values = { ...COMPLETE, ...overrides };
  const set = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
  set(/^Company name/, values.company);
  set(/^Industry/, values.industry);
  if (values.industry === 'Other') set(/^Your industry/, values.otherIndustry);
  set(/^Problem faced/, values.problem);
  set(/^Solution provided/, values.solution);
  set(/^Results \/ impact/, values.results);
  set(/^Testimonial quote/, values.testimonial);
  set(/^Client contact name/, values.contactName);
  set(/^Client contact email/, values.contactEmail);
};

const withSupabase = () => {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon');
};

describe('the Resources page Submit a case study button', () => {
  it('opens the form at its own address, and closing goes back to /resources', async () => {
    const location = memoryLocation({ path: '/resources', record: true });
    render(<Router hook={location.hook}><ResourcesPage t={THEME} /></Router>);

    fireEvent.click(screen.getByRole('button', { name: 'Submit a case study' }));
    expect(location.history.at(-1)).toBe('/resources/submit-case-study');
    expect(await screen.findByRole('dialog', { name: 'Submit a case study' })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(location.history.at(-1)).toBe('/resources');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('is open straight away at /resources/submit-case-study', async () => {
    const location = memoryLocation({ path: '/resources/submit-case-study' });
    render(<Router hook={location.hook}><ResourcesPage t={THEME} /></Router>);

    expect(await screen.findByRole('dialog', { name: 'Submit a case study' })).toBeInTheDocument();
  });
});

describe('CaseStudyDialog', () => {
  beforeEach(() => {
    insert.mockReset();
    from.mockClear();
    getSession.mockReset();
    uploadMedia.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('marks the required fields, and only those', () => {
    render(<CaseStudyDialog t={THEME} onClose={vi.fn()} />);

    expect(screen.getByLabelText(/^Company name/)).toHaveFocus();
    for (const label of [/^Company name/, /^Industry/, /^Problem faced/, /^Solution provided/,
      /^Results \/ impact/, /^Client contact name/, /^Client contact email/]) {
      expect(screen.getByLabelText(label)).toBeRequired();
      expect(screen.getByLabelText(label).labels[0]).toHaveTextContent('*');
    }
    expect(screen.getByLabelText(/^Testimonial quote/)).not.toBeRequired();
    expect(screen.getByLabelText(/^Testimonial quote/).labels[0]).toHaveTextContent('(optional)');
    expect(screen.getByLabelText(/^Client contact email/)).toHaveAttribute('type', 'email');
  });

  it('files the submission, trimmed, and confirms it', async () => {
    withSupabase();
    insert.mockResolvedValue({ error: null });
    render(<CaseStudyDialog t={THEME} onClose={vi.fn()} />);

    fill({ company: '  Malmö Stad  ', testimonial: '“It worked.” — Ana', contactEmail: ' ana@example.org ' });
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    expect(await screen.findByRole('status')).toHaveTextContent(/your case study is in/);
    expect(from).toHaveBeenCalledWith('case_study_submissions');
    expect(insert).toHaveBeenCalledWith({
      company: 'Malmö Stad',
      industry: 'Local government',
      problem: 'Nobody came to consultations.',
      solution: 'We ran a Desire Lines walk.',
      results: '300 people took part, four times the usual.',
      testimonial: '“It worked.” — Ana',
      contact_name: 'Ana Lind',
      contact_email: 'ana@example.org',
    });
  });

  it('takes a typed industry when Other is chosen', async () => {
    withSupabase();
    insert.mockResolvedValue({ error: null });
    render(<CaseStudyDialog t={THEME} onClose={vi.fn()} />);

    fill({ industry: 'Other', otherIndustry: 'Tourism' });
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    await screen.findByRole('status');
    expect(insert.mock.calls[0][0]).toMatchObject({ industry: 'Tourism', testimonial: null });
  });

  it('flags every missing field and a bad email, and sends nothing', () => {
    withSupabase();
    render(<CaseStudyDialog t={THEME} onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/^Client contact email/), { target: { value: 'not-an-address' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    expect(screen.getByRole('alert')).toHaveTextContent(/required fields need fixing/);
    expect(screen.getByLabelText(/^Company name/)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText(/^Company name/)).toHaveAccessibleDescription('Enter the company or organisation name.');
    expect(screen.getByLabelText(/^Client contact email/)).toHaveAccessibleDescription(/valid email address/);
    expect(screen.getByLabelText(/^Testimonial quote/)).not.toHaveAttribute('aria-invalid');
    expect(screen.getByLabelText(/^Company name/)).toHaveFocus();
    expect(insert).not.toHaveBeenCalled();
  });

  it('clears a field’s message once it is fixed', () => {
    withSupabase();
    render(<CaseStudyDialog t={THEME} onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
    fireEvent.change(screen.getByLabelText(/^Company name/), { target: { value: 'Malmö Stad' } });

    expect(screen.getByLabelText(/^Company name/)).not.toHaveAttribute('aria-invalid');
    expect(screen.getByLabelText(/^Problem faced/)).toHaveAttribute('aria-invalid', 'true');
  });

  it('shows the error and keeps what was typed when the insert is refused', async () => {
    withSupabase();
    insert.mockResolvedValue({ error: { message: 'nope' } });
    render(<CaseStudyDialog t={THEME} onClose={vi.fn()} />);

    fill();
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('nope'));
    expect(screen.getByLabelText(/^Company name/)).toHaveValue('Malmö Stad');
  });

  it('asks a signed-out visitor to sign in to attach pictures', () => {
    withSupabase();
    vi.stubEnv('VITE_MEDIA_URL', 'https://media.example.org');
    render(<CaseStudyDialog t={THEME} onClose={vi.fn()} />);

    expect(screen.queryByLabelText(/^Client logo/)).toBeNull();
    expect(screen.getAllByText(/Sign in before you start/)).toHaveLength(2);
  });

  it('uploads a signed-in submitter’s logo and picture to their own folder', async () => {
    withSupabase();
    vi.stubEnv('VITE_MEDIA_URL', 'https://media.example.org');
    getSession.mockResolvedValue({ data: { session: { user: { id: '11111111-1111-1111-1111-111111111111' } } } });
    insert.mockResolvedValue({ error: null });
    render(<CaseStudyDialog t={THEME} signedIn onClose={vi.fn()} />);

    fill();
    const png = new File(['png'], 'logo.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText(/^Client logo/), { target: { files: [png] } });
    fireEvent.change(screen.getByLabelText(/^Case study image/), { target: { files: [png] } });
    expect(screen.getAllByText('logo.png')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    await screen.findByRole('status');
    expect(uploadMedia).toHaveBeenCalledTimes(2);
    const row = insert.mock.calls[0][0];
    expect(row.logo_path).toMatch(/^case-studies\/11111111-1111-1111-1111-111111111111\/logo-\d+\.webp$/);
    expect(row.image_path).toMatch(/^case-studies\/11111111-1111-1111-1111-111111111111\/image-\d+\.webp$/);
  });

  it('offers email instead when there is no Supabase project', () => {
    render(<CaseStudyDialog t={THEME} onClose={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Submit by email' })).toBeInTheDocument();
    expect(insert).not.toHaveBeenCalled();
  });

  it('closes from the backdrop but not from inside the form', () => {
    const onClose = vi.fn();
    render(<CaseStudyDialog t={THEME} onClose={onClose} />);

    fireEvent.click(screen.getByLabelText(/^Company name/));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('dialog').parentElement);
    expect(onClose).toHaveBeenCalled();
  });
});

describe('caseStudySubmissions', () => {
  it('passes a complete submission', () => {
    expect(validateCaseStudy(COMPLETE)).toBeNull();
  });

  it('wants a typed industry when Other is chosen', () => {
    expect(validateCaseStudy({ ...COMPLETE, industry: 'Other' })).toEqual({ otherIndustry: 'Name the industry.' });
    expect(cleanCaseStudy({ ...COMPLETE, industry: 'Other', otherIndustry: ' Tourism ' }).industry).toBe('Tourism');
  });

  it('carries every field in the email fallback', () => {
    const body = decodeURIComponent(submitCaseStudyByEmailHref({ ...COMPLETE, testimonial: 'Great' }).split('body=')[1]);
    for (const value of ['Malmö Stad', 'Local government', 'Nobody came', 'Desire Lines', '300 people',
      'Great', 'Contact: Ana Lind <ana@example.org>']) {
      expect(body).toContain(value);
    }
  });
});
