import { describe, it, expect } from 'vite-plus/test';
import { FULL_SCREEN_TOOLS, isFullScreenTool, startedToolPath } from '../routes';
import { REGISTERED_TOOLS } from '../../toolkit/tools';

describe('full-screen tools', () => {
  it('names only tools the Toolkit has', () => {
    const ids = REGISTERED_TOOLS.map((tool) => tool.id);
    for (const id of FULL_SCREEN_TOOLS) expect(ids).toContain(id);
  });

  it('is started only past its cover, with ?start', () => {
    expect(isFullScreenTool('/toolkit/reimagine-a-space', 'start')).toBe(true);
    expect(isFullScreenTool('/toolkit/reimagine-a-space', 'project=proj-1&start')).toBe(true);
    expect(isFullScreenTool('/toolkit/reimagine-a-space', '')).toBe(false);
    expect(isFullScreenTool('/toolkit/reimagine-a-space', 'project=proj-1')).toBe(false);
  });

  it('is never any other tool, or any other page', () => {
    expect(isFullScreenTool('/toolkit/budget-ballot', 'start')).toBe(false);
    expect(isFullScreenTool('/toolkit', 'start')).toBe(false);
    expect(isFullScreenTool('/dashboard', 'start')).toBe(false);
  });

  it('keeps the rest of the query when started', () => {
    expect(startedToolPath('reimagine-a-space', '')).toBe('/toolkit/reimagine-a-space?start');
    expect(startedToolPath('reimagine-a-space', 'project=proj-1'))
      .toBe('/toolkit/reimagine-a-space?project=proj-1&start');
    expect(startedToolPath('reimagine-a-space', '?project=proj-1'))
      .toBe('/toolkit/reimagine-a-space?project=proj-1&start');
  });
});
