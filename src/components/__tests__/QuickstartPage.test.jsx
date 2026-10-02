import { describe, it, expect, vi } from 'vite-plus/test';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { QuickstartPage } from '../QuickstartPage';
import { THEME } from '../../theme';

describe('QuickstartPage', () => {
  it('walks through the five steps of starting a project, in order', () => {
    render(<QuickstartPage t={THEME} onNewProject={vi.fn()} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Create your first Project' })).toBeInTheDocument();
    const steps = within(screen.getAllByRole('list')[0]).getAllByRole('heading', { level: 3 });
    expect(steps.map((step) => step.textContent)).toEqual([
      'Read what a project is',
      'Choose what kind of project it is',
      'Fill in the basics',
      'Mark the place',
      'Add an image',
    ]);
  });

  it('ends on the button that starts one', () => {
    const onNewProject = vi.fn();
    render(<QuickstartPage t={THEME} onNewProject={onNewProject} />);

    fireEvent.click(screen.getByRole('button', { name: 'Create a Project' }));

    expect(onNewProject).toHaveBeenCalled();
  });
});
