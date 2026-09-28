import { describe, it, expect } from 'vite-plus/test';
import { fitTo, IMAGE_PRESETS } from '../imageEncode';

/*
 * Only the arithmetic. The encode itself needs a browser's image decoder and canvas,
 * which jsdom does not have; the services that call it fake it, and the real thing is
 * exercised by uploading a picture in the app.
 */

describe('sizing a picture for its preset', () => {
  it('scales a big photo down so its longest side fits', () => {
    expect(fitTo(4032, 3024, IMAGE_PRESETS.cover)).toMatchObject({ width: 1920, height: 1440 });
    expect(fitTo(3024, 4032, IMAGE_PRESETS.project)).toMatchObject({ width: 1200, height: 1600 });
  });

  it('never scales a small picture up', () => {
    expect(fitTo(800, 600, IMAGE_PRESETS.cover)).toMatchObject({ sx: 0, sy: 0, sw: 800, sh: 600, width: 800, height: 600 });
  });

  it('crops an avatar to the middle square, then scales it', () => {
    expect(fitTo(4000, 3000, IMAGE_PRESETS.avatar))
      .toEqual({ sx: 500, sy: 0, sw: 3000, sh: 3000, width: 512, height: 512 });
    expect(fitTo(300, 400, IMAGE_PRESETS.avatar))
      .toEqual({ sx: 0, sy: 50, sw: 300, sh: 300, width: 300, height: 300 });
  });

  it('keeps every side at least a pixel, however thin the picture', () => {
    expect(fitTo(10000, 2, IMAGE_PRESETS.cover)).toMatchObject({ width: 1920, height: 1 });
  });
});
