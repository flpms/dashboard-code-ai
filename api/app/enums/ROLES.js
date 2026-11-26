'use strict';

export const ROLES = Object.freeze({
  SUPER_ADMIN: 'super-admin',
  ADMIN: 'admin',
  MEMBER: 'member',
  READ_ONLY: 'read-only',
});

export const ROLE_VALUES = Object.freeze(Object.values(ROLES));

/**
 * Roles that may act across tenants. Everything else is pinned to the tenant on
 * the user document — see `tenant-scope.hook.js`.
 */
export const CROSS_TENANT_ROLES = Object.freeze([ROLES.SUPER_ADMIN]);
