import { describe, expect, it, vi } from 'vitest';

import { SettingsService } from './settings.service.js';

const fakeClient = () => ({
  request: vi.fn(),
  get: vi.fn(async () => ({})),
  post: vi.fn(),
  put: vi.fn(async () => ({})),
  patch: vi.fn(async () => ({})),
  remove: vi.fn(async () => ({})),
  subscribe: vi.fn(() => () => {}),
});

describe('SettingsService', () => {
  it('reads and saves the settings', async () => {
    const client = fakeClient();
    await SettingsService(client).get();
    await SettingsService(client).update({ backfillHours: 12 });
    expect(client.get).toHaveBeenCalledWith('/v1/settings');
    expect(client.patch).toHaveBeenCalledWith('/v1/settings', { backfillHours: 12 });
  });

  it('installs with PUT and removes with DELETE', async () => {
    const client = fakeClient();
    await SettingsService(client).installHooks();
    await SettingsService(client).removeHooks();
    expect(client.put).toHaveBeenCalledWith('/v1/settings/hooks');
    expect(client.remove).toHaveBeenCalledWith('/v1/settings/hooks');
  });
});
