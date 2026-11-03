import { describe, it, expect, vi } from 'vite-plus/test';
import { render, screen, within } from '@testing-library/react';
import { Tutorials } from '../Tutorials';
import { TUTORIALS } from '../../toolkit/tutorials';
import { THEME } from '../../theme';

vi.mock('../../toolkit/tutorials', () => ({
  TUTORIALS: [
    { id: 'made', title: 'Create your first tool', duration: '3 min', embedUrl: 'https://www.youtube-nocookie.com/embed/abc' },
    { id: 'to-come', title: 'Run a tool live with a group', duration: null, embedUrl: null },
  ],
}));

describe('Tutorials', () => {
  it('plays a tutorial that has a video in place, and holds a placeholder for one that does not', () => {
    render(<Tutorials t={THEME} />);
    const section = screen.getByRole('region', { name: 'Tutorials' });

    expect(within(section).getAllByRole('listitem')).toHaveLength(TUTORIALS.length);
    expect(within(section).getByTitle('Create your first tool'))
      .toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/abc');
    expect(within(section).getByText('3 min')).toBeInTheDocument();
    expect(within(section).getByRole('img', { name: 'Video coming soon: Run a tool live with a group' }))
      .toBeInTheDocument();
  });
});
