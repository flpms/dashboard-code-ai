import { describe, expect, it } from 'vitest';

import { formatDateTime, statusClass, statusLabel } from './format.js';

describe('format helpers', () => {
  it('renders an em dash for a missing date instead of "Invalid Date"', () => {
    expect(formatDateTime(null)).toBe('—');
    expect(formatDateTime(undefined)).toBe('—');
  });

  it('formats an ISO date in pt-BR', () => {
    expect(formatDateTime('2026-03-15T12:00:00.000Z')).toMatch(/15\/03\/2026/);
  });

  it('falls back to the raw value for an unknown status', () => {
    expect(statusLabel('quarantined')).toBe('quarantined');
    expect(statusClass('quarantined')).toBe(statusClass('draft'));
  });

  it('translates the known statuses', () => {
    expect(statusLabel('active')).toBe('Ativo');
  });
});
