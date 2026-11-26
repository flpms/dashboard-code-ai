import { describe, expect, it } from 'vitest';

import { baseName, formatDateTime, formatDuration, safeLink, shortPath } from './format.js';

describe('format helpers', () => {
  it('renders an em dash for a missing date instead of "Invalid Date"', () => {
    expect(formatDateTime(null)).toBe('—');
    expect(formatDateTime(undefined)).toBe('—');
  });

  it('formats an ISO date in pt-BR', () => {
    expect(formatDateTime('2026-03-15T12:00:00.000Z')).toMatch(/15\/03\/2026/);
  });

  it('picks the unit a person reads without arithmetic', () => {
    expect(formatDuration(320)).toBe('320 ms');
    expect(formatDuration(4200)).toBe('4,2 s');
    expect(formatDuration(185_000)).toBe('3 min 05 s');
    expect(formatDuration(null)).toBe('—');
  });

  it('shows paths relative to the session folder when inside it', () => {
    expect(shortPath('/repo/src/a.js', '/repo')).toBe('src/a.js');
    expect(shortPath('/other/a.js', '/repo')).toBe('/other/a.js');
    expect(shortPath('/repo/src/a.js', null)).toBe('/repo/src/a.js');
  });

  it('names a session by its last folder', () => {
    expect(baseName('/home/me/projects/api')).toBe('api');
    expect(baseName(null)).toBe('—');
  });

  it('only lets https links through', () => {
    expect(safeLink('https://github.com/advisories/GHSA-1')).toBe(
      'https://github.com/advisories/GHSA-1'
    );
    expect(safeLink('javascript:alert(1)')).toBeUndefined();
    expect(safeLink(null)).toBeUndefined();
  });
});
