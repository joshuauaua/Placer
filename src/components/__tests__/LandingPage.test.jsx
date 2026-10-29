import { describe, it, expect, vi, afterEach } from 'vite-plus/test';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import { LandingPage } from '../LandingPage';
import { THEME } from '../../theme';

describe('LandingPage hero', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('says what PLACER is for, with one way in', () => {
    render(<LandingPage t={THEME} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Understand, imagine and plan. Together.' }))
      .toBeInTheDocument();
    expect(screen.getByText(/Get everyone involved in shaping the world around/)).toBeInTheDocument();
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
    for (const name of ['Gehl Institute', 'STPLN', 'Ankara Aks']) {
      expect(within(partners).getByRole('link', { name })).toHaveAttribute('target', '_blank');
    }
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

  it('follows the testimonials with why it matters', () => {
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

  it('shows one of three testimonials at a time, stepping round either way', () => {
    const { container } = render(<LandingPage t={THEME} />);
    const shown = () => [...container.querySelectorAll('.placer-landing-testimonial')]
      .findIndex((card) => !card.hidden);

    expect(container.querySelectorAll('.placer-landing-testimonial')).toHaveLength(3);
    expect(shown()).toBe(0);

    fireEvent.click(screen.getByRole('button', { name: 'Next testimonial' }));
    expect(shown()).toBe(1);
    expect(screen.getByText('2 / 3')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Previous testimonial' }));
    fireEvent.click(screen.getByRole('button', { name: 'Previous testimonial' }));
    expect(shown()).toBe(2);
  });

  it('shows how easy it is to start, over three cards', () => {
    render(<LandingPage t={THEME} />);
    const section = screen.getByRole('region', { name: 'Easy to start.Simple to connect.' });

    expect(within(section).getAllByRole('heading', { level: 3 }).map((h) => h.textContent))
      .toEqual(['Customizable templates', 'Instant presentations', 'Flexible setups']);
  });

  it('shows the power of participation through case studies', () => {
    render(<LandingPage t={THEME} />);
    const section = screen.getByRole('region', { name: 'The power ofparticipation.' });

    expect(within(section).getAllByRole('article')).toHaveLength(3);
    // At the start of the row, only forward makes sense.
    expect(within(section).getByRole('button', { name: 'Previous case study' })).toBeDisabled();
    expect(within(section).getByRole('button', { name: 'Next case study' })).toBeEnabled();
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
