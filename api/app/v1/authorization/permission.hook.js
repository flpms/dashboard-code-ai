'use strict';

/**
 * Authorization, part 1: does this identity hold one of the roles the route
 * asks for?
 *
 * The user is loaded from the database rather than trusted from the token: a
 * role revoked five minutes ago must not survive in a token issued an hour ago.
 */
export default ({ Logger, enums: { HTTP_MESSAGES }, repositories: { usersRepository } }) => {
  const refuse = (request, reply, reason) => {
    Logger.warn(`NOT AUTHORIZED::${reason}: ${request.ip} "${request.method} ${request.url}"`);
    return reply.code(403).send({ message: HTTP_MESSAGES.FORBIDDEN });
  };

  return allowedRoles => async (request, reply) => {
    const email = request.tokenPayload?.email;

    if (!email) return refuse(request, reply, 'NO IDENTITY IN TOKEN');

    const user = await usersRepository.findOne({ email, deleted: false });

    if (!user) return refuse(request, reply, 'USER NOT FOUND');

    if (!allowedRoles.includes(user.role)) {
      Logger.debug(`ALLOWED: ${allowedRoles.join(', ')} - USER: ${user.role}`);
      return refuse(request, reply, 'ROLE NOT ALLOWED');
    }

    request.user = user;
  };
};
