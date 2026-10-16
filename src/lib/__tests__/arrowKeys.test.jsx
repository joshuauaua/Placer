import { describe, it, expect } from 'vite-plus/test';
import { render, screen, fireEvent } from '@testing-library/react';
import { ARROW_ITEM, moveWithArrows } from '../arrowKeys';

const Cards = () => (
  <div onKeyDown={moveWithArrows}>
    {['One', 'Two', 'Three'].map((name) => <button key={name} type="button" {...ARROW_ITEM}>{name}</button>)}
    <button type="button">Not a card</button>
    <input aria-label="Field" />
  </div>
);

describe('moveWithArrows', () => {
  it('moves between the cards with the arrow keys, Home and End', () => {
    render(<Cards />);
    const card = (name) => screen.getByRole('button', { name });
    card('One').focus();

    fireEvent.keyDown(card('One'), { key: 'ArrowRight' });
    expect(card('Two')).toHaveFocus();
    fireEvent.keyDown(card('Two'), { key: 'ArrowDown' });
    expect(card('Three')).toHaveFocus();
    fireEvent.keyDown(card('Three'), { key: 'ArrowRight' });
    expect(card('Three')).toHaveFocus();
    fireEvent.keyDown(card('Three'), { key: 'Home' });
    expect(card('One')).toHaveFocus();
    fireEvent.keyDown(card('One'), { key: 'ArrowUp' });
    expect(card('One')).toHaveFocus();
    fireEvent.keyDown(card('One'), { key: 'End' });
    expect(card('Three')).toHaveFocus();
  });

  it('leaves keys alone anywhere but on a card', () => {
    render(<Cards />);
    const field = screen.getByLabelText('Field');
    field.focus();

    fireEvent.keyDown(field, { key: 'ArrowLeft' });

    expect(field).toHaveFocus();
  });
});
