import { describe, it, expect, vi } from 'vite-plus/test';
import { render, screen, fireEvent } from '@testing-library/react';
import { ONBOARDING_STEPS, OnboardingDialog } from '../OnboardingDialog';
import { THEME } from '../../theme';

const setup = (handlers = {}) => {
  const props = {
    onClose: vi.fn(), onExplore: vi.fn(), onOpenToolkit: vi.fn(), onNewProject: vi.fn(), onEditProfile: vi.fn(),
    ...handlers,
  };
  render(<OnboardingDialog t={THEME} name="Mara" {...props} />);
  return props;
};

const next = () => fireEvent.click(screen.getByRole('button', { name: 'Next' }));

describe('OnboardingDialog', () => {
  it('has five steps', () => {
    expect(ONBOARDING_STEPS).toHaveLength(5);
  });

  it('opens on a welcome by name, which can be skipped', () => {
    const { onClose } = setup();

    expect(screen.getByRole('dialog', { name: 'Welcome to PLACER, Mara' })).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 5')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('goes through all five steps and back, and Get started ends it', () => {
    const { onClose } = setup();

    const titles = ['Explore what is happening', 'Try the Toolkit', 'Start a project', 'Make your profile yours'];
    titles.forEach((title, i) => {
      next();
      expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
      expect(screen.getByText(`Step ${i + 2} of 5`)).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('heading', { name: 'Start a project' })).toBeInTheDocument();

    next();
    fireEvent.click(screen.getByRole('button', { name: 'Get started' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('jumps to a step from its dot', () => {
    setup();

    fireEvent.click(screen.getByRole('button', { name: 'Step 4: Start a project' }));

    expect(screen.getByRole('heading', { name: 'Start a project' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Step 4: Start a project' })).toHaveAttribute('aria-current', 'step');
  });

  it("names the Toolkit's three categories", () => {
    setup();
    next();
    next();

    const categories = screen.getByRole('list', { name: 'Toolkit categories' });
    expect(categories).toHaveTextContent('Understand');
    expect(categories).toHaveTextContent('Imagine');
    expect(categories).toHaveTextContent('Plan');
  });

  it.each([
    [1, 'Open the map', 'onExplore'],
    [2, 'Browse the Toolkit', 'onOpenToolkit'],
    [3, 'Create a project', 'onNewProject'],
    [4, 'Edit my profile', 'onEditProfile'],
  ])('step %i goes to %s, ending the tour', (steps, label, handler) => {
    const props = setup();
    for (let i = 0; i < steps; i += 1) next();

    fireEvent.click(screen.getByRole('button', { name: label }));

    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(props[handler]).toHaveBeenCalledTimes(1);
  });

  it('leaves out a step\'s button when there is nothing for it to do', () => {
    setup({ onNewProject: undefined });
    fireEvent.click(screen.getByRole('button', { name: 'Step 4: Start a project' }));

    expect(screen.queryByRole('button', { name: 'Create a project' })).not.toBeInTheDocument();
  });

  it('closes on Escape and the close button, and moves with the arrow keys', () => {
    const { onClose } = setup();
    const dialog = screen.getByRole('dialog');

    fireEvent.keyDown(dialog, { key: 'ArrowRight' });
    expect(screen.getByText('Step 2 of 5')).toBeInTheDocument();
    fireEvent.keyDown(dialog, { key: 'ArrowLeft' });
    expect(screen.getByText('Step 1 of 5')).toBeInTheDocument();

    fireEvent.keyDown(dialog, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Close the welcome tour' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
