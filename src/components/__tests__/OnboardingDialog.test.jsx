import { describe, it, expect, vi, afterEach } from 'vite-plus/test';
import { render, screen, fireEvent } from '@testing-library/react';
import { ONBOARDING_STEPS, OnboardingDialog } from '../OnboardingDialog';
import { THEME } from '../../theme';

const setup = (handlers = {}) => {
  const props = {
    onClose: vi.fn(), onOpenProjects: vi.fn(), onExplore: vi.fn(), onOpenToolkit: vi.fn(), onNewProject: vi.fn(), onEditProfile: vi.fn(),
    ...handlers,
  };
  render(<OnboardingDialog t={THEME} name="Mara" {...props} />);
  return props;
};

// Next, or Get started on the cover, which is the same thing there.
const next = () => fireEvent.click(screen.queryByRole('button', { name: 'Next' })
  ?? screen.getByRole('button', { name: 'Get started' }));

describe('OnboardingDialog', () => {
  it('has a cover and five steps', () => {
    expect(ONBOARDING_STEPS).toHaveLength(6);
    expect(ONBOARDING_STEPS.filter((s) => s.cover)).toHaveLength(1);
  });

  it('shows the bench from the favicon on the welcome step', () => {
    const { container } = render(<OnboardingDialog t={THEME} name="Mara" onClose={vi.fn()} />);
    expect(container.querySelector('img[src="/favicon.svg"]')).toBeInTheDocument();
  });

  it('opens on a cover by name: not a numbered step, and only Get started', () => {
    const { onClose } = setup();

    expect(screen.getByRole('dialog', { name: 'Welcome to PLACER, Mara' })).toBeInTheDocument();
    expect(screen.queryByText(/Step \d of/)).not.toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Steps' })).not.toBeInTheDocument();
    for (const name of ['Back', 'Next', 'Skip']) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    }

    fireEvent.click(screen.getByRole('button', { name: 'Get started' }));
    expect(screen.getByText('Step 1 of 5')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Step \d:/ })).toHaveLength(5);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('goes back to the cover from the first step', () => {
    setup();
    next();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('button', { name: 'Get started' })).toBeInTheDocument();
  });

  it('goes through all five steps and back, ending on Edit my profile rather than Done', () => {
    setup();

    const titles = ['Projects are where change starts', 'Check out the Toolkit', 'Explore what is happening',
      'Start your own project', 'Make your profile yours'];
    titles.forEach((title, i) => {
      next();
      expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
      expect(screen.getByText(`Step ${i + 1} of 5`)).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('heading', { name: 'Start your own project' })).toBeInTheDocument();

    next();
    expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Edit my profile' })).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
  });

  it('jumps to a step from its dot', () => {
    setup();
    next();

    fireEvent.click(screen.getByRole('button', { name: 'Step 4: Start your own project' }));

    expect(screen.getByRole('heading', { name: 'Start your own project' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Step 4: Start your own project' })).toHaveAttribute('aria-current', 'step');
  });

  it("shows no category tags on the Toolkit step", () => {
    setup();
    next();
    next();

    expect(screen.queryByRole('list', { name: 'Toolkit categories' })).not.toBeInTheDocument();
  });

  it.each([
    [1, 'See the projects', 'onOpenProjects'],
    [2, 'Browse the Toolkit', 'onOpenToolkit'],
    [3, 'Open the map', 'onExplore'],
    [4, 'Create a project', 'onNewProject'],
  ])('step %i goes to %s and carries on to the next step', (steps, label, handler) => {
    const props = setup();
    for (let i = 0; i < steps; i += 1) next();

    fireEvent.click(screen.getByRole('button', { name: label }));

    expect(props[handler]).toHaveBeenCalledTimes(1);
    expect(props.onClose).not.toHaveBeenCalled();
    expect(screen.getByText(`Step ${steps + 1} of 5`)).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toHaveFocus();
  });

  it('ends the tour from the last step\'s button', () => {
    const props = setup();
    for (let i = 0; i < 5; i += 1) next();

    fireEvent.click(screen.getByRole('button', { name: 'Edit my profile' }));

    expect(props.onEditProfile).toHaveBeenCalledTimes(1);
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('leaves out a step\'s button when there is nothing for it to do', () => {
    setup({ onNewProject: undefined });
    next();
    fireEvent.click(screen.getByRole('button', { name: 'Step 4: Start your own project' }));

    expect(screen.queryByRole('button', { name: 'Create a project' })).not.toBeInTheDocument();
  });

  it('closes on Escape and the close button, and moves with the arrow keys', () => {
    const { onClose } = setup();
    const dialog = screen.getByRole('dialog');

    fireEvent.keyDown(dialog, { key: 'ArrowRight' });
    expect(screen.getByText('Step 1 of 5')).toBeInTheDocument();
    fireEvent.keyDown(dialog, { key: 'ArrowLeft' });
    expect(screen.getByRole('button', { name: 'Get started' })).toBeInTheDocument();

    fireEvent.keyDown(dialog, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Close the welcome tour' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  describe('the spotlit steps, with the side nav on screen', () => {
    let item;
    afterEach(() => item?.remove());

    const withNavItem = (target = 'map') => {
      item = document.createElement('button');
      item.dataset.tour = target;
      item.getBoundingClientRect = () => ({ top: 120, left: 20, width: 240, height: 48 });
      document.body.append(item);
    };

    it('points at Explore in the menu instead of offering a button', () => {
      withNavItem();
      const { onClose, onExplore } = setup();
      next();
      next();
      next();

      expect(screen.queryByRole('note')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Open the map' })).not.toBeInTheDocument();

      const spot = screen.getByRole('button', { name: 'Explore' });
      expect(spot).toHaveStyle({ top: '114px', left: '14px', width: '252px', height: '60px' });

      fireEvent.click(spot);
      expect(onExplore).toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
      expect(screen.getByText('Step 4 of 5')).toBeInTheDocument();
    });

    it('points at Projects in the menu on the projects step', () => {
      withNavItem('projects');
      const { onOpenProjects } = setup();
      next();

      expect(screen.queryByText(/Click Projects in the menu/)).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Projects' }));
      expect(onOpenProjects).toHaveBeenCalled();
      expect(screen.getByText('Step 2 of 5')).toBeInTheDocument();
    });

    it('points at Toolkit in the menu on the Toolkit step', () => {
      withNavItem('toolkit');
      const { onOpenToolkit } = setup();
      next();
      next();

      expect(screen.queryByText(/Click Toolkit in the menu/)).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Toolkit' }));
      expect(onOpenToolkit).toHaveBeenCalled();
      expect(screen.getByText('Step 3 of 5')).toBeInTheDocument();
    });

    it('points at New project in the menu on the start-a-project step', () => {
      withNavItem('newProject');
      const { onNewProject } = setup();
      next();
      next();
      next();
      next();

      expect(screen.queryByRole('button', { name: 'Create a project' })).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'New project' }));
      expect(onNewProject).toHaveBeenCalled();
      expect(screen.getByText('Step 5 of 5')).toBeInTheDocument();
    });

    it('keeps the button when the menu is not there to point at', () => {
      setup();
      next();
      next();
      next();

      expect(screen.queryByRole('note')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Open the map' })).toBeInTheDocument();
    });
  });
});
