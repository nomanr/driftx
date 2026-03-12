import { describe, it, expect, vi } from 'vitest';
import { getClipboardCommand } from '../../../src/formatters/clipboard.js';

describe('getClipboardCommand', () => {
  it('returns pbcopy on darwin', () => {
    expect(getClipboardCommand('darwin')).toBe('pbcopy');
  });

  it('returns clip on win32', () => {
    expect(getClipboardCommand('win32')).toBe('clip');
  });

  it('returns xclip on linux', () => {
    expect(getClipboardCommand('linux')).toBe('xclip -selection clipboard');
  });

  it('returns undefined on unsupported platform', () => {
    expect(getClipboardCommand('freebsd')).toBeUndefined();
  });
});
