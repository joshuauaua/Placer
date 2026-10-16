import { describe, it, expect, afterEach } from 'vite-plus/test';
import { isNewProjectShortcut, isSearchShortcut } from '../shortcuts';

const press = (key, extra = {}) => ({ key, target: document.body, ...extra });

afterEach(() => {
  document.body.innerHTML = '';
});

describe('the search shortcut', () => {
  it('is ⌘K or Ctrl+K, and nothing else', () => {
    expect(isSearchShortcut(press('k', { metaKey: true }))).toBe(true);
    expect(isSearchShortcut(press('K', { ctrlKey: true }))).toBe(true);
    expect(isSearchShortcut(press('k'))).toBe(false);
    expect(isSearchShortcut(press('k', { metaKey: true, shiftKey: true }))).toBe(false);
  });
});

describe('the new-project shortcut', () => {
  it('is N on its own', () => {
    expect(isNewProjectShortcut(press('n'))).toBe(true);
    expect(isNewProjectShortcut(press('N', { metaKey: true }))).toBe(false);
    expect(isNewProjectShortcut(press('n', { ctrlKey: true }))).toBe(false);
    expect(isNewProjectShortcut(press('n', { repeat: true }))).toBe(false);
  });

  it('is only typing in a field', () => {
    document.body.innerHTML = '<input id="name"><textarea id="note"></textarea>';
    expect(isNewProjectShortcut(press('n', { target: document.getElementById('name') }))).toBe(false);
    expect(isNewProjectShortcut(press('n', { target: document.getElementById('note') }))).toBe(false);
  });

  it('does nothing while a dialog is open', () => {
    document.body.innerHTML = '<div role="dialog" aria-modal="true"></div>';
    expect(isNewProjectShortcut(press('n'))).toBe(false);
  });
});
