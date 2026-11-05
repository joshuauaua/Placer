import { describe, it, expect } from 'vite-plus/test';
import { combinePins, defaultPinSetup, pinAt, pinSetupProblems, readPin } from '../pinToImage';
import { findTool } from '../../toolkit/tools';

describe('Pin to Image', () => {
  it('needs a question and a picture, and takes Word Cloud\'s timer', () => {
    expect(pinSetupProblems(defaultPinSetup())).toEqual([
      'Write what you want people to answer.', 'Add a picture for people to pin on.',
    ]);
    expect(pinSetupProblems({ prompt: 'Where would you sit?', imagePath: 'scenes/p/pin.webp', timer: 60 })).toEqual([]);
    expect(pinSetupProblems({ prompt: 'Where?', imagePath: 'scenes/p/pin.webp', timer: 7 })).toHaveLength(1);
  });

  it('places a pin as fractions of the picture, wherever it is drawn', () => {
    const rect = { left: 100, top: 50, width: 400, height: 200 };
    expect(pinAt(rect, 300, 150)).toEqual({ x: 0.5, y: 0.5 });
    expect(pinAt(rect, 0, 400)).toEqual({ x: 0, y: 1 });
    expect(pinAt({ left: 0, top: 0, width: 0, height: 0 }, 1, 1)).toBeNull();
  });

  it('takes only pins that are on the picture, and counts the people who pinned', () => {
    expect(readPin({ x: 0.2, y: 1 })).toEqual({ x: 0.2, y: 1 });
    expect(readPin({ x: 1.2, y: 0.5 })).toBeNull();
    expect(combinePins([{ pin: { x: 0.1, y: 0.2 } }, { pin: null }, { timer: { endsAt: 1 } }, { pin: { x: 0.3, y: 0.4 } }]))
      .toEqual({ pins: [{ x: 0.1, y: 0.2 }, { x: 0.3, y: 0.4 }], people: 2 });
  });

  it('is an Imagine tool, live or self-paced, of several slides, with its results', () => {
    const tool = findTool('pin-to-image');
    expect(tool).toMatchObject({ category: 'imagine', delivery: ['live', 'self-paced'], slides: true });
    expect(tool.results.View).toBeTypeOf('function');
    expect(tool.setup.title.key).toBe('prompt');
    expect(tool.setup.steps.map((step) => step.title)).toEqual(['Prompt', 'Picture', 'Timer']);
  });
});
