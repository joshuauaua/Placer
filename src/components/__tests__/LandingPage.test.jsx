import { describe, it, expect, vi, afterEach } from 'vite-plus/test';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import { LandingPage } from '../LandingPage';
import { THEME } from '../../theme';
import { lastMap } from '../../test/maplibreStub';

describe('LandingPage hero', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('says what PLACER is for, with one way in', () => {
    render(<LandingPage t={THEME} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Understand, Imagine and Plan the City. Together.' }))
      .toBeInTheDocument();
    expect(screen.getByText(/Get everyone involved in shaping the urban environment/)).toBeInTheDocument();
    const hero = screen.getByRole('heading', { level: 1 }).closest('section');
    expect(within(hero).getAllByRole('button')).toHaveLength(1);
  });

  it('opens the waitlist from Get started', async () => {
    render(<LandingPage t={THEME} />);

    fireEvent.click(screen.getByRole('button', { name: 'Get started' }));

    expect(await screen.findByRole('dialog', { name: 'Join the Waitlist' })).toBeInTheDocument();
  });

  it('names the practices it is built with, each linking out', () => {
    render(<LandingPage t={THEME} />);

    const partners = screen.getByRole('region', { name: 'Developed with leading design experts' });
    for (const name of ['STPLN', 'Ankara Aks']) {
      expect(within(partners).getByRole('link', { name })).toHaveAttribute('target', '_blank');
    }
    // Hidden for now.
    expect(within(partners).queryByRole('link', { name: 'Gehl Institute' })).toBeNull();
  });

  it('says how it works under the partners', () => {
    render(<LandingPage t={THEME} />);

    expect(screen.getByRole('heading', { level: 2, name: 'Good questions,great insights.' })).toBeInTheDocument();
    expect(screen.getByText(/Start with a question\. Get answers in real time\./)).toBeInTheDocument();
  });

  it('shows one step at a time, the first to begin with', () => {
    render(<LandingPage t={THEME} />);

    const tabs = within(screen.getByRole('tablist', { name: 'How it works' })).getAllByRole('tab');
    expect(tabs).toHaveLength(3);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: /Ask a question/ })).toBeInTheDocument();

    fireEvent.click(tabs[2]);

    expect(tabs[2]).toHaveAttribute('aria-selected', 'true');
    expect(tabs[0]).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('tabpanel', { name: /Shape what comes next/ })).toBeInTheDocument();
  });

  it('moves to the next step every five seconds, and back to the first', () => {
    vi.useFakeTimers();
    render(<LandingPage t={THEME} />);
    const tabs = screen.getAllByRole('tab');

    act(() => { vi.advanceTimersByTime(4999); });
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    act(() => { vi.advanceTimersByTime(1); });
    expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
    act(() => { vi.advanceTimersByTime(5000); });
    expect(tabs[2]).toHaveAttribute('aria-selected', 'true');
    act(() => { vi.advanceTimersByTime(5000); });
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
  });

  it('holds while the pointer is on the steps, then takes up the time it had left', () => {
    vi.useFakeTimers();
    const { container } = render(<LandingPage t={THEME} />);
    const steps = container.querySelector('.placer-landing-steps');
    const tabs = screen.getAllByRole('tab');

    act(() => { vi.advanceTimersByTime(3000); });
    fireEvent.mouseEnter(steps);
    expect(steps).toHaveAttribute('data-paused', 'true');
    act(() => { vi.advanceTimersByTime(20000); });
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');

    fireEvent.mouseLeave(steps);
    act(() => { vi.advanceTimersByTime(1999); });
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    act(() => { vi.advanceTimersByTime(1); });
    expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
  });

  it('gives a clicked step its whole time', () => {
    vi.useFakeTimers();
    render(<LandingPage t={THEME} />);
    const tabs = screen.getAllByRole('tab');

    act(() => { vi.advanceTimersByTime(4000); });
    fireEvent.click(tabs[2]);
    act(() => { vi.advanceTimersByTime(4999); });
    expect(tabs[2]).toHaveAttribute('aria-selected', 'true');
    act(() => { vi.advanceTimersByTime(1); });
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
  });

  it('follows how it works with why it matters', () => {
    render(<LandingPage t={THEME} />);

    expect(screen.getByRole('heading', { level: 2, name: 'More engagement,every day.' })).toBeInTheDocument();
    expect(screen.getByText(/Easily add participation into more areas of work and learning/)).toBeInTheDocument();
  });

  it('switches the card between audiences, opening one item at a time', () => {
    render(<LandingPage t={THEME} />);
    const toggle = screen.getByRole('tablist', { name: 'Who it is for' });
    const card = () => screen.getByRole('tabpanel', { name: /Design Practitioners|City Officials/ });

    expect(within(toggle).getByRole('tab', { name: 'Design Practitioners' })).toHaveAttribute('aria-selected', 'true');
    expect(within(card()).getByRole('button', { name: 'Run live workshops' })).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(within(card()).getByRole('button', { name: 'Sketch ideas together' }));
    expect(within(card()).getByRole('button', { name: 'Sketch ideas together' })).toHaveAttribute('aria-expanded', 'true');
    expect(within(card()).getByRole('button', { name: 'Run live workshops' })).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(within(toggle).getByRole('tab', { name: 'City Officials' }));
    expect(within(card()).getByRole('button', { name: 'Reach more residents' })).toHaveAttribute('aria-expanded', 'true');
    expect(within(card()).queryByRole('button', { name: 'Run live workshops' })).not.toBeInTheDocument();
  });

  it('leaves out the testimonials and "Easy to start" for now', () => {
    const { container } = render(<LandingPage t={THEME} />);

    expect(container.querySelector('.placer-landing-testimonials')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Next testimonial' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Easy to start.Simple to connect.' })).toBeNull();
    expect(screen.queryByText('Customizable templates')).toBeNull();
  });

  it('shows the power of participation through case studies', () => {
    render(<LandingPage t={THEME} />);
    const section = screen.getByRole('region', { name: 'The power ofparticipation.' });

    expect(within(section).getAllByRole('article')).toHaveLength(3);
    // At the start of the row, only forward makes sense.
    expect(within(section).getByRole('button', { name: 'Previous case study' })).toBeDisabled();
    expect(within(section).getByRole('button', { name: 'Next case study' })).toBeEnabled();
  });

  it('maps the case studies beside the title, a pin for each', async () => {
    render(<LandingPage t={THEME} />);
    const section = screen.getByRole('region', { name: 'The power ofparticipation.' });

    const map = await within(section).findByTestId('landing-cases-map');
    expect(map.parentElement).toContainElement(within(section).getByRole('heading', { level: 2 }));
    expect(map.compareDocumentPosition(within(section).getByRole('list', { name: 'Case studies' })))
      .toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(lastMap().markers).toHaveLength(3);
  });

  it('puts an email from the waitlist form on the waitlist', async () => {
    render(<LandingPage t={THEME} />);
    const waitlist = screen.getByRole('region', { name: 'Join the waitlist' });

    fireEvent.change(within(waitlist).getByLabelText('Email'), { target: { value: ' ana@example.com ' } });
    fireEvent.click(within(waitlist).getByRole('button', { name: 'Join the waitlist' }));

    expect(await within(waitlist).findByRole('status')).toHaveTextContent('on the list');
    const saved = JSON.parse(localStorage.getItem('placemaking_survey_responses'));
    expect(saved.at(-1)).toMatchObject({ source: 'landing_survey', email: 'ana@example.com' });
  });
});

describe('LandingPage on Development', () => {
  it('credits who develops PLACER and who funds it, at its foot', () => {
    render(<LandingPage t={THEME} />);

    expect(screen.getByText(/funded by the Swedish Institute/i)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Funded by Swedish Institute' })).toBeInTheDocument();
  });
});

describe('LandingPage, adding a case study', () => {
  it('invites a case study after the case studies, opening the form', () => {
    render(<LandingPage t={THEME} />);

    const band = screen.getByRole('region', { name: 'Add a case study' });
    expect(within(band).getByRole('link', { name: 'Add a case study' })).toHaveAttribute('href', '/add-a-case-study');
  });
});
