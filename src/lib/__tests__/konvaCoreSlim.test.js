import { describe, it, expect } from 'vite-plus/test';
import { Konva } from '../konva-core-slim';

describe('konva-core-slim', () => {
  it('assigns DD onto Konva so drag state reads resolve', () => {
    expect(Konva.DD).toBeDefined();
    expect(Konva.DD._dragElements instanceof Map).toBe(true);
  });

  // Stage.js calls Konva.isDragging() on every pointer event. Global.js reads
  // Konva.DD.isDragging, so a missing DD throws on every move.
  it('exposes isDragging() without throwing', () => {
    expect(() => Konva.isDragging()).not.toThrow();
    expect(Konva.isDragging()).toBe(false);
  });
});
