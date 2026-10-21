import { describe, it, expect } from 'vite-plus/test';
import { copyWidths, photoUploads, responsiveImage, srcSetFor } from '../responsiveImage';

const BASE = 'https://media.example/projects/p-1/image-1';

describe('the copies of an uploaded picture', () => {
  it('are made only at the widths narrower than the picture', () => {
    expect(copyWidths(1600)).toEqual([640, 1080]);
    expect(copyWidths(900)).toEqual([640]);
    expect(copyWidths(640)).toEqual([]);
  });

  it('go up before the picture, named by width, so a page never asks for one not there yet', () => {
    const blob = new Blob(['full']);
    const small = new Blob(['640']);
    const medium = new Blob(['1080']);
    expect(photoUploads('projects/p-1/image-1', {
      blob, ext: 'webp', width: 1600, copies: [{ width: 640, blob: small }, { width: 1080, blob: medium }],
    })).toEqual([
      { path: 'projects/p-1/image-1-w640.webp', blob: small },
      { path: 'projects/p-1/image-1-w1080.webp', blob: medium },
      { path: 'projects/p-1/image-1-w1600.webp', blob },
    ]);
  });

  it('leave a picture without any its plain name', () => {
    const blob = new Blob(['x']);
    expect(photoUploads('avatars/u-1/avatar-1', { blob, ext: 'webp', width: 512, copies: [] }))
      .toEqual([{ path: 'avatars/u-1/avatar-1.webp', blob }]);
  });
});

describe('the srcset for a picture', () => {
  it('lists its copies and itself by width', () => {
    expect(srcSetFor(`${BASE}-w1600.webp`))
      .toBe(`${BASE}-w640.webp 640w, ${BASE}-w1080.webp 1080w, ${BASE}-w1600.webp 1600w`);
    expect(srcSetFor(`${BASE}-w900.jpg`)).toBe(`${BASE}-w640.jpg 640w, ${BASE}-w900.jpg 900w`);
  });

  it('keeps a query on every address', () => {
    expect(srcSetFor(`${BASE}-w1080.webp?v=2`)).toBe(`${BASE}-w640.webp?v=2 640w, ${BASE}-w1080.webp?v=2 1080w`);
  });

  it('is left out for a picture from before copies, or anything that is not an uploaded picture', () => {
    expect(srcSetFor(`${BASE}.webp`)).toBeUndefined();
    expect(srcSetFor(`${BASE}-w640.webp`)).toBeUndefined();
    expect(srcSetFor('data:image/png;base64,AAAA')).toBeUndefined();
    expect(srcSetFor(null)).toBeUndefined();
  });

  it('comes with its sizes and lazy loading, unless the picture is wanted at once', () => {
    expect(responsiveImage(`${BASE}-w1600.webp`, '100vw')).toEqual({
      src: `${BASE}-w1600.webp`, srcSet: srcSetFor(`${BASE}-w1600.webp`), sizes: '100vw', loading: 'lazy', decoding: 'async',
    });
    expect(responsiveImage(`${BASE}.webp`, '100vw', { eager: true }))
      .toEqual({ src: `${BASE}.webp`, loading: 'eager', decoding: 'async' });
  });
});
