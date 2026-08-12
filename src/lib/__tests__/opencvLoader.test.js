import { describe, it, expect, beforeEach, afterEach } from 'vite-plus/test';
import { loadOpenCv, setOpenCv, _resetOpenCvCache } from '../opencvLoader';

function scriptTags() {
  return Array.from(document.querySelectorAll('script[src]'));
}

beforeEach(() => {
  _resetOpenCvCache();
  for (const tag of scriptTags()) tag.remove();
  delete globalThis.cv;
});

afterEach(() => {
  for (const tag of scriptTags()) tag.remove();
  delete globalThis.cv;
});

describe('loadOpenCv', () => {
  it('injects exactly one classic <script> whose src ends in the OpenCV asset path, and resolves with globalThis.cv', async () => {
    globalThis.cv = { detect: () => 'stub' };
    const promise = loadOpenCv();

    const tags = scriptTags();
    expect(tags).toHaveLength(1);
    expect(tags[0].src.endsWith(__OPENCV_ASSET_PATH__)).toBe(true);
    expect(tags[0].type).not.toBe('module');

    tags[0].dispatchEvent(new Event('load'));
    await expect(promise).resolves.toBe(globalThis.cv);
  });

  it('memoises: a second loadOpenCv() adds no second tag', async () => {
    globalThis.cv = { detect: () => 'stub' };
    const first = loadOpenCv();
    scriptTags()[0].dispatchEvent(new Event('load'));
    await first;

    const second = loadOpenCv();
    expect(scriptTags()).toHaveLength(1);
    await expect(second).resolves.toBe(globalThis.cv);
  });

  it('unwraps a thenable globalThis.cv (Emscripten MODULARIZE shape)', async () => {
    const cv = { detect: () => 'stub' };
    globalThis.cv = Promise.resolve(cv);
    const promise = loadOpenCv();
    scriptTags()[0].dispatchEvent(new Event('load'));
    await expect(promise).resolves.toBe(cv);
  });

  it('unwraps a { default: cv } shape', async () => {
    const cv = { detect: () => 'stub' };
    globalThis.cv = { default: cv };
    const promise = loadOpenCv();
    scriptTags()[0].dispatchEvent(new Event('load'));
    await expect(promise).resolves.toBe(cv);
  });

  it('rejects on the tag error event and clears the memo, so the next call injects again', async () => {
    const promise = loadOpenCv();
    scriptTags()[0].dispatchEvent(new Event('error'));
    await expect(promise).rejects.toBeTruthy();
    expect(scriptTags()).toHaveLength(0);

    globalThis.cv = { detect: () => 'stub' };
    const retry = loadOpenCv();
    expect(scriptTags()).toHaveLength(1);
    scriptTags()[0].dispatchEvent(new Event('load'));
    await expect(retry).resolves.toBe(globalThis.cv);
  });

  it('setOpenCv(stub) resolves without touching the DOM', async () => {
    const stub = { detect: () => 'stub' };
    setOpenCv(stub);
    await expect(loadOpenCv()).resolves.toBe(stub);
    expect(scriptTags()).toHaveLength(0);
  });
});
