import { describe, expect, it, vi } from 'vitest';

import { ItemsService } from './items.service.js';

const fakeClient = () => ({
  get: vi.fn(async () => ({ items: [] })),
  post: vi.fn(async () => ({})),
  patch: vi.fn(async () => ({})),
  remove: vi.fn(async () => null),
});

describe('ItemsService', () => {
  it('scopes every path to the tenant it was given', async () => {
    const client = fakeClient();

    await ItemsService(client).get('tenant-1', 'item-9');

    expect(client.get).toHaveBeenCalledWith('/v1/tenant/tenant-1/items/item-9');
  });

  it('sends pagination as query parameters', async () => {
    const client = fakeClient();

    await ItemsService(client).list('tenant-1', { page: 3, itemsPerPage: 50 });

    expect(client.get).toHaveBeenCalledWith('/v1/tenant/tenant-1/items?page=3&itemsPerPage=50');
  });

  it('leaves an empty search out of the query string', async () => {
    const client = fakeClient();

    await ItemsService(client).list('tenant-1');

    expect(client.get.mock.calls[0][0]).not.toContain('search');
  });
});
