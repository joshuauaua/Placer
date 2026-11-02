import { describe, it, expect, vi } from 'vite-plus/test';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { PopularTemplates } from '../PopularTemplates';
import { TEMPLATES } from '../../toolkit/templates';
import { findTool } from '../../toolkit/tools';
import { THEME } from '../../theme';

describe('TEMPLATES', () => {
  it('each uses a tool in the register, under an id of its own', () => {
    for (const template of TEMPLATES) expect(findTool(template.tool)).not.toBeNull();
    expect(new Set(TEMPLATES.map((template) => template.id)).size).toBe(TEMPLATES.length);
  });
});

describe('PopularTemplates', () => {
  it('shows a card per template, with its title and the kind of tool it is, and its colour for a picture', () => {
    render(<PopularTemplates t={THEME} onOpen={vi.fn()} />);
    const section = screen.getByRole('region', { name: 'Popular Templates' });

    const card = within(section).getByRole('button', { name: 'Interior Shared Space Ideation, Idea Visualizer' });
    // No pictures yet: a block of the tool's category colour stands in.
    expect(within(card).queryByRole('img')).toBeNull();
    expect(card.querySelector('.placer-template-image')).toHaveStyle({ background: 'rgb(255, 217, 184)' });
    expect(card).toHaveTextContent('Interior Shared Space Ideation');
    expect(card).toHaveTextContent('Idea Visualizer');
    expect(within(section).getByRole('button', { name: 'Split a group budget for an event, Co-Budget' })).toBeInTheDocument();
    expect(within(section).getByRole('button', { name: 'Community Event Ice-breaker, Pop Quiz' })).toBeInTheDocument();
  });

  it('opens the tool a template uses', () => {
    const onOpen = vi.fn();
    render(<PopularTemplates t={THEME} onOpen={onOpen} />);

    fireEvent.click(screen.getByRole('button', { name: /Split a group budget/ }));
    expect(onOpen).toHaveBeenCalledWith('budget-ballot');
  });
});
