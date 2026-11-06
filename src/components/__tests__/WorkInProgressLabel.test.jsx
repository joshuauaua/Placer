import { describe, it, expect, afterEach } from 'vite-plus/test';
import { render, screen, cleanup } from '@testing-library/react';
import { WorkInProgressLabel, isWorkInProgress } from '../toolkit/WorkInProgressLabel';
import { REGISTERED_TOOLS, findTool } from '../../toolkit/tools';

describe('Work in Progress', () => {
  afterEach(() => cleanup());

  it('labels every tool but People Moving Count, Word Cloud, Pin to Image and Poll', () => {
    const ready = REGISTERED_TOOLS.filter((tool) => !isWorkInProgress(tool)).map((tool) => tool.id).sort();
    expect(ready).toEqual(['open-vote', 'people-moving-count', 'pin-to-image', 'word-cloud']);
    expect(findTool('open-vote').name).toBe('Poll');
  });

  it('labels a new tool until it is marked ready', () => {
    expect(isWorkInProgress({ id: 'brand-new' })).toBe(true);
  });

  it('shows on the picture of a tool still being made, and not on a finished one', () => {
    render(<WorkInProgressLabel tool={findTool('stationary-activity-mapping')} />);
    expect(screen.getByText('Work in Progress')).toBeInTheDocument();
    cleanup();
    render(<WorkInProgressLabel tool={findTool('word-cloud')} />);
    expect(screen.queryByText('Work in Progress')).not.toBeInTheDocument();
  });
});
