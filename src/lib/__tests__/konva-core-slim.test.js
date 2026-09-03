import { describe, it, expect } from 'vite-plus/test';
import { Konva } from '../konva-core-slim';

// The slim shim must keep the DD (DragAndDrop) module on the Konva global.
// Stage reads Konva.DD on every pointer move through Konva.isDragging(), so a
// missing DD makes the first pointer move over the canvas throw a TypeError
// and the whole stage renders black.
describe('konva-core-slim', () => {
  it('exposes DD so a pointer move does not throw in isDragging()', () => {
    expect(Konva.DD).toBeDefined();
    expect(Konva.isDragging()).toBe(false);
  });
})
