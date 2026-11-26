'use strict';

/**
 * Authorization, part 2: is this identity allowed inside *this* tenant?
 *
 * Role alone is not enough. Without this check, an `admin` of tenant A reaches
 * tenant B's data by editing the URL — the role matches, the query is scoped to
 * whatever `:tenantId` says, and the response is a clean 200. This is the
 * classic multi-tenant horizontal escalation, and it is invisible in tests that
 * only ever use one tenant.
 *
 * Runs after `permission.hook`, which is what puts `request.user` in place.
 */
export default ({ Logger, enums: { CROSS_TENANT_ROLES, HTTP_MESSAGES }, ObjectId }) =>
  async (request, reply) => {
    const requested = request.params.tenantId;

    if (!ObjectId.isValid(requested)) {
      return reply.code(400).send({ message: HTTP_MESSAGES.BAD_REQUEST });
    }

    // A route can only be tenant-scoped if something already identified the
    // caller. Reaching here without `request.user` means routes.json declared
    // `tenant: true` without `roles` — a wiring bug, not a client error.
    if (!request.user) {
      Logger.error(`TENANT SCOPE without an authenticated user: ${request.method} ${request.url}`);
      return reply.code(500).send({ message: HTTP_MESSAGES.UNHANDLED_ERROR });
    }

    const crossTenant = CROSS_TENANT_ROLES.includes(request.user.role);
    const ownTenant = String(request.user.tenantId) === String(requested);

    if (!crossTenant && !ownTenant) {
      Logger.warn(
        `NOT AUTHORIZED::TENANT MISMATCH: user=${request.user.email} own=${request.user.tenantId} requested=${requested}`
      );
      return reply.code(403).send({ message: HTTP_MESSAGES.FORBIDDEN });
    }

    // Downstream code reads the tenant from here, never from `request.params`.
    request.tenantId = new ObjectId(requested);
  };
