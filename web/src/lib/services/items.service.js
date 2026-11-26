/**
 * One resource, one service. Stateless factory, no stores, no other services —
 * composition happens in the page that uses them.
 *
 * The tenant is an argument, never a module constant: a hardcoded tenant is the
 * reason a "multi-tenant" front end quietly only ever works for one customer.
 *
 * @import { HttpClient, Item, Paged } from '$lib/types.js'
 */

/**
 * @param {HttpClient} client
 */
export const ItemsService = client => {
  /** @param {string} tenantId */
  const base = tenantId => `/v1/tenant/${tenantId}/items`;

  /**
   * @param {string} tenantId
   * @param {{ page?: number, itemsPerPage?: number, search?: string }} [query]
   * @returns {Promise<Paged<Item>>}
   */
  const list = (tenantId, { page = 1, itemsPerPage = 20, search = '' } = {}) => {
    const params = new URLSearchParams({ page: String(page), itemsPerPage: String(itemsPerPage) });

    if (search) params.set('search', search);

    return client.get(`${base(tenantId)}?${params}`);
  };

  /**
   * @param {string} tenantId
   * @param {string} id
   * @returns {Promise<Item>}
   */
  const get = (tenantId, id) => client.get(`${base(tenantId)}/${id}`);

  /**
   * @param {string} tenantId
   * @param {Partial<Item>} attributes
   * @returns {Promise<Item>}
   */
  const create = (tenantId, attributes) => client.post(base(tenantId), attributes);

  /**
   * @param {string} tenantId
   * @param {string} id
   * @param {Partial<Item>} attributes
   * @returns {Promise<Item>}
   */
  const update = (tenantId, id, attributes) => client.patch(`${base(tenantId)}/${id}`, attributes);

  /**
   * @param {string} tenantId
   * @param {string} id
   * @returns {Promise<null>}
   */
  const remove = (tenantId, id) => client.remove(`${base(tenantId)}/${id}`);

  return { create, get, list, remove, update };
};
