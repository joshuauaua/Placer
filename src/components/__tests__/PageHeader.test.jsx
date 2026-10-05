import { describe, it, expect } from 'vite-plus/test';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { Router } from 'wouter';
import { memoryLocation } from 'wouter/memory-location';
import { PageHeader } from '../PageHeader';
import { THEME } from '../../theme';

function renderHeader(props) {
  const memory = memoryLocation({ path: '/explore', record: true });
  render(<Router hook={memory.hook}><PageHeader t={THEME} {...props} /></Router>);
  return memory;
}

describe('PageHeader', () => {
  it('shows where the page sits under My Workspace', () => {
    renderHeader({ title: 'Explore' });
    const crumbs = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(crumbs).toHaveTextContent('My Workspace/Explore');
    expect(within(crumbs).getByText('Explore')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('heading', { level: 1, name: 'Explore' })).toBeInTheDocument();
  });

  it('goes back to the dashboard from My Workspace', () => {
    const { history } = renderHeader({ title: 'Explore' });
    const link = screen.getByRole('link', { name: 'My Workspace' });
    expect(link).toHaveAttribute('href', '/dashboard');

    fireEvent.click(link);

    expect(history.at(-1)).toBe('/dashboard');
  });
});
