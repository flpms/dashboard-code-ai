'use strict';

const signInController =
  ({ signIn, responseHandler }) =>
  (request, reply) =>
    signIn({ data: request.body, onFinish: responseHandler(request, reply) });

const verifyTokenController =
  ({ verifyToken, responseHandler }) =>
  (request, reply) =>
    verifyToken({
      data: { tokenPayload: request.tokenPayload },
      onFinish: responseHandler(request, reply),
    });

export const AuthController = deps => ({
  signIn: signInController(deps),
  verifyToken: verifyTokenController(deps),
});
