import { describe, it, expect } from 'vite-plus/test';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { DreamIt } from '../toolkit/DreamIt';
import { findTool } from '../../toolkit/tools';
import { PROMPTS } from '../../lib/dreamIt';
import { THEME } from '../../theme';

/** The tool is handed the register entry it belongs to, exactly as the page does. */
function mount(Tool, id) {
  return render(<Tool t={THEME} tool={findTool(id)} />);
}

describe('Dream It', () => {
  const shown = (prompts = PROMPTS) => prompts.filter((prompt) => screen.queryByText(prompt));
  const choose = (name) => fireEvent.click(screen.getByRole('button', { name }));
  const write = (prompt) => {
    fireEvent.change(screen.getByLabelText('Your prompt'), { target: { value: prompt } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
  };
  const press = (prompts) => {
    fireEvent.click(screen.getByRole('button', { name: /^Generate/ }));
    return shown(prompts)[0];
  };

  it('opens by asking which prompts to use, before any generator', () => {
    mount(DreamIt, 'dream-it');

    expect(screen.getByRole('button', { name: /Use the existing prompts/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Write your own prompts/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Keep the existing ones and add your own/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Generate/ })).not.toBeInTheDocument();
  });

  describe('with the existing prompts', () => {
    it('goes straight to the generator, with no prompt showing yet', () => {
      mount(DreamIt, 'dream-it');
      choose(/Use the existing prompts/);

      expect(shown()).toEqual([]);
      expect(screen.getByRole('button', { name: 'Generate a prompt' })).toBeInTheDocument();
      expect(screen.getByText(`${PROMPTS.length} prompts`)).toBeInTheDocument();
      expect(screen.queryByText(/not saved/)).not.toBeInTheDocument();
    });

    it('shows one prompt when the button is pressed', () => {
      mount(DreamIt, 'dream-it');
      choose(/Use the existing prompts/);

      fireEvent.click(screen.getByRole('button', { name: 'Generate a prompt' }));

      expect(shown()).toHaveLength(1);
      expect(screen.getByRole('button', { name: 'Generate another prompt' })).toBeInTheDocument();
    });

    it('goes through every prompt before repeating one, and never the same twice running', () => {
      mount(DreamIt, 'dream-it');
      choose(/Use the existing prompts/);

      const first = Array.from({ length: PROMPTS.length }, () => press());
      expect(new Set(first).size).toBe(PROMPTS.length);

      let last = first.at(-1);
      for (let i = 0; i < PROMPTS.length; i += 1) {
        const next = press();
        expect(next).not.toBe(last);
        last = next;
      }
    });
  });

  describe('with prompts of your own', () => {
    const OWN = ['What would the trees ask for?', 'Who is this square for at night?'];

    it('asks for them first, says they are not saved, and will not start with none', () => {
      mount(DreamIt, 'dream-it');
      choose(/Write your own prompts/);

      expect(screen.getByLabelText('Your prompt')).toBeInTheDocument();
      expect(screen.getByText(/refreshing or leaving this page loses them/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Start with/ })).toBeDisabled();
    });

    it('deals only the prompts that were written', () => {
      mount(DreamIt, 'dream-it');
      choose(/Write your own prompts/);
      OWN.forEach(write);
      write(`  ${OWN[0].toUpperCase()} `);

      expect(within(screen.getByRole('list', { name: 'Your prompts' })).getAllByRole('listitem')).toHaveLength(2);
      choose('Start with 2 prompts');

      const dealt = [press(OWN), press(OWN)];
      expect([...dealt].sort()).toEqual([...OWN].sort());
      expect(shown()).toEqual([]);
      expect(screen.getByText(/not saved/)).toBeInTheDocument();
    });

    it('takes a prompt back out before starting', () => {
      mount(DreamIt, 'dream-it');
      choose(/Write your own prompts/);
      OWN.forEach(write);

      choose(`Remove “${OWN[0]}”`);

      expect(screen.getByRole('button', { name: 'Start with 1 prompt' })).toBeEnabled();
    });

    it('keeps the existing prompts as well when asked to, with the new ones among them', () => {
      mount(DreamIt, 'dream-it');
      choose(/Keep the existing ones and add your own/);
      write(OWN[0]);
      write(PROMPTS[0]);
      choose(`Start with ${PROMPTS.length + 1} prompts`);

      const all = [...PROMPTS, OWN[0]];
      const dealt = Array.from({ length: all.length }, () => press(all));
      expect([...dealt].sort()).toEqual([...all].sort());
    });

    it('goes back to the choice without losing what was written', () => {
      mount(DreamIt, 'dream-it');
      choose(/Write your own prompts/);
      OWN.forEach(write);
      choose('Start with 2 prompts');

      choose('Change the prompts');
      choose(/Write your own prompts/);

      expect(within(screen.getByRole('list', { name: 'Your prompts' })).getAllByRole('listitem')).toHaveLength(2);
    });
  });
});
