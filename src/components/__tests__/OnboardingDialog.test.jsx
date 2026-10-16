import { describe, it, expect, vi, afterEach } from 'vite-plus/test';
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

  it('shows the bench from the favicon on the welcome step', () => {
    const { container } = render(<OnboardingDialog t={THEME} name="Mara" onClose={vi.fn()} />);
    expect(container.querySelector('img[src="/favicon.svg"]')).toBeInTheDocument();
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

  describe('the Explore step, with the side nav on screen', () => {
    let item;
    afterEach(() => item?.remove());

    const withNavItem = () => {
      item = document.createElement('button');
      item.dataset.tour = 'map';
      item.getBoundingClientRect = () => ({ top: 120, left: 20, width: 240, height: 48 });
      document.body.append(item);
    };

    it('points at Explore in the menu instead of offering a button', () => {
      withNavItem();
      const { onClose, onExplore } = setup();
      next();

      expect(screen.getByRole('note')).toHaveTextContent('Click Explore in the menu');
      expect(screen.queryByRole('button', { name: 'Open the map' })).not.toBeInTheDocument();

      const spot = screen.getByRole('button', { name: 'Explore' });
      expect(spot).toHaveStyle({ top: '114px', left: '14px', width: '252px', height: '60px' });

      fireEvent.click(spot);
      expect(onClose).toHaveBeenCalled();
      expect(onExplore).toHaveBeenCalled();
    });

    it('keeps the button when the menu is not there to point at', () => {
      setup();
      next();

      expect(screen.queryByRole('note')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Open the map' })).toBeInTheDocument();
    });
  });
});
