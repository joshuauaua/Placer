import { describe, it, expect } from 'vite-plus/test';
import { render, screen } from '@testing-library/react';
import { AboutPage } from '../AboutPage';
import { THEME } from '../../theme';

describe('AboutPage', () => {
  it('leads with the title and a User Labs photo', () => {
    render(<AboutPage t={THEME} />);

    expect(screen.getByRole('heading', { level: 1, name: 'About PLACER' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /User Labs session/i })).toBeInTheDocument();
  });

  it('has a section for what it does, how it is built and who is behind it', () => {
    render(<AboutPage t={THEME} />);

    const sections = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(sections).toEqual([
      'Built with the people who will use it',
      'Grounded in how cities work today',
      'Made with ♥ in Malmö and Ankara',
    ]);
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent))
      .toEqual(['Understand', 'Imagine', 'Plan']);
  });

  it('shows the team photo and links the partners out, in a new tab', () => {
    render(<AboutPage t={THEME} />);

    expect(screen.getByRole('img', { name: /people behind PLACER/i })).toBeInTheDocument();

    expect(screen.getByRole('link', { name: 'STPLN' })).toHaveAttribute('href', 'https://stpln.se/');
    expect(screen.getByRole('link', { name: 'Ankara Aks' })).toHaveAttribute('target', '_blank');
    expect(screen.getByRole('img', { name: 'Funded by Swedish Institute' })).toBeInTheDocument();
  });
});
