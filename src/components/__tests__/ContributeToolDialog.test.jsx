import { describe, it, expect, vi, beforeEach, afterEach } from 'vite-plus/test';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Router } from 'wouter';
import { memoryLocation } from 'wouter/memory-location';
import { THEME } from '../../theme';

const insert = vi.fn();
const from = vi.fn(() => ({ insert }));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ from }) }));

import { ContributeToolDialog } from '../ContributeToolDialog';
import { ToolkitPage } from '../ToolkitPage';
import { submitToolByEmailHref, validateToolSubmission } from '../../services/toolSubmissions';

const fill = ({ title = 'Walkshop kit', description = 'A printable guide for neighbourhood walks.',
  email = 'ana@example.org' } = {}) => {
  fireEvent.change(screen.getByLabelText('Title'), { target: { value: title } });
  fireEvent.change(screen.getByLabelText('Description'), { target: { value: description } });
  fireEvent.change(screen.getByLabelText('Email address'), { target: { value: email } });
};

const withSupabase = () => {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon');
};

describe('the Toolkit Contribute button', () => {
  it('opens the pop-up form, and Escape closes it', async () => {
    const location = memoryLocation({ path: '/toolkit', record: true });
    render(<Router hook={location.hook}><ToolkitPage t={THEME} /></Router>);

    fireEvent.click(await screen.findByRole('button', { name: /^Contribute/ }));

    expect(screen.getByRole('dialog', { name: 'Contribute a tool' })).toBeInTheDocument();
    expect(location.history.at(-1)).toBe('/toolkit');

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('ContributeToolDialog', () => {
  beforeEach(() => {
    insert.mockReset();
    from.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('asks for a title, a description and an email address', () => {
    render(<ContributeToolDialog t={THEME} onClose={vi.fn()} />);

    expect(screen.getByLabelText('Title')).toHaveFocus();
    expect(screen.getByLabelText('Description')).toBeInTheDocument();
    expect(screen.getByLabelText('Email address')).toHaveAttribute('type', 'email');
  });

  it('files the submission, trimmed', async () => {
    withSupabase();
    insert.mockResolvedValue({ error: null });
    render(<ContributeToolDialog t={THEME} onClose={vi.fn()} />);

    fill({ title: '  Walkshop kit  ', email: ' ana@example.org ' });
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    expect(await screen.findByRole('status')).toHaveTextContent(/we have it/);
    expect(from).toHaveBeenCalledWith('tool_submissions');
    expect(insert).toHaveBeenCalledWith({
      title: 'Walkshop kit',
      description: 'A printable guide for neighbourhood walks.',
      email: 'ana@example.org',
    });
  });

  it.each([
    ['title', { title: '  ' }, /title/],
    ['description', { description: '' }, /Describe/],
    ['email', { email: 'not-an-address' }, /email address/],
  ])('will not send without a %s', (_, fields, message) => {
    withSupabase();
    render(<ContributeToolDialog t={THEME} onClose={vi.fn()} />);

    fill(fields);
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    expect(screen.getByRole('alert')).toHaveTextContent(message);
    expect(insert).not.toHaveBeenCalled();
  });

  it('shows the error and keeps what was typed when the insert is refused', async () => {
    withSupabase();
    insert.mockResolvedValue({ error: { message: 'nope' } });
    render(<ContributeToolDialog t={THEME} onClose={vi.fn()} />);

    fill();
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('nope'));
    expect(screen.getByLabelText('Title')).toHaveValue('Walkshop kit');
  });

  it('offers email instead when there is no Supabase project', () => {
    render(<ContributeToolDialog t={THEME} onClose={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Submit by email' })).toBeInTheDocument();
    expect(insert).not.toHaveBeenCalled();
  });

  it('closes from the backdrop but not from inside the form', () => {
    const onClose = vi.fn();
    render(<ContributeToolDialog t={THEME} onClose={onClose} />);

    fireEvent.click(screen.getByLabelText('Title'));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('dialog').parentElement);
    expect(onClose).toHaveBeenCalled();
  });
});

describe('toolSubmissions', () => {
  it('passes a complete submission', () => {
    expect(validateToolSubmission({ title: 'Kit', description: 'Does things', email: 'a@b.co' })).toBeNull();
  });

  it('carries every field in the email fallback', () => {
    const href = submitToolByEmailHref({ title: 'Kit', description: 'Does things', email: 'a@b.co' });
    expect(href).toMatch(/^mailto:/);
    expect(decodeURIComponent(href)).toContain('PLACER Toolkit submission: Kit');
    const body = decodeURIComponent(href.split('body=')[1]);
    expect(body).toContain('Does things');
    expect(body).toContain('Contact: a@b.co');
  });
});
