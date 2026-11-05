import { describe, it, expect } from 'vite-plus/test';
import {
  area, birdsEyeSetupProblems, combineLayouts, defaultBirdsEyeSetup, formatLength, newAsset, placed, readLayout,
  rectangleOutline, scalePlan, sides,
} from '../birdsEye';
import { findTool } from '../../toolkit/tools';

describe('Birds Eye View', () => {
  it('starts from a 20 by 12 metre rectangle, and needs a question and a titled piece', () => {
    const setup = defaultBirdsEyeSetup();
    expect(area(setup.outline)).toBe(240);
    expect(birdsEyeSetupProblems(setup)).toEqual([
      'Write what you want people to answer.', 'Add at least one piece for people to place.',
    ]);
    const bench = { ...newAsset(setup, 'rect', 'bench'), title: '' };
    expect(birdsEyeSetupProblems({ ...setup, prompt: 'Where?', assets: [bench] })).toEqual(['Give piece 1 a title.']);
    expect(birdsEyeSetupProblems({ ...setup, prompt: 'Where?', assets: [{ ...bench, title: 'Work bench' }] })).toEqual([]);
  });

  it('labels each side with its length', () => {
    expect(sides(rectangleOutline(20, 12)).map((side) => formatLength(side.length))).toEqual(['20 m', '12 m', '20 m', '12 m']);
    expect(formatLength(0.8)).toBe('80 cm');
    expect(formatLength(7.25)).toBe('7.3 m');
  });

  it('stretches the plan, and what is in it, to the size typed in', () => {
    const setup = { ...defaultBirdsEyeSetup(), assets: [{ id: 'a', title: 'Stage', shape: 'rect', w: 2, d: 1, x: 10, y: 6, r: 0 }] };
    const scaled = scalePlan(setup, 40, 6);
    expect(scaled.outline).toEqual(rectangleOutline(40, 6));
    expect(scaled.assets[0]).toMatchObject({ x: 20, y: 3, w: 2, d: 1 });
  });

  it('puts a new piece in the middle of the place', () => {
    expect(newAsset(defaultBirdsEyeSetup(), 'circle', 'c')).toMatchObject({ id: 'c', shape: 'circle', x: 10, y: 6, r: 0 });
  });

  it('keeps the layouts people sent, for pieces the plan has', () => {
    const config = { assets: [{ id: 'a', title: 'Stage', shape: 'rect', w: 2, d: 1, x: 1, y: 1 }] };
    const combined = combineLayouts([
      { layout: { a: { x: 5, y: 5, r: 90 }, ghost: { x: 1, y: 1 } } }, { layout: null }, { timer: { endsAt: 1 } },
    ], config);
    expect(combined).toEqual({ layouts: [{ a: { x: 5, y: 5, r: 90 } }], people: 1 });
    expect(placed(config.assets, readLayout({ a: { x: 3, y: 4 } }, config.assets))[0]).toMatchObject({ x: 3, y: 4, r: 0 });
  });

  it('is an Imagine tool, live or self-paced, set up on the canvas, with results', () => {
    const tool = findTool('birds-eye-view');
    expect(tool).toMatchObject({ category: 'imagine', delivery: ['live', 'self-paced'] });
    expect(tool.setup.Canvas).toBeTypeOf('function');
    expect(tool.setup.steps.map((step) => step.title)).toEqual(['Prompt', 'Plan', 'Timer']);
    expect(tool.results.View).toBeTypeOf('function');
  });
});
