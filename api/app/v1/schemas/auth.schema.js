'use strict';

export const AuthSchema = Joi => ({
  signIn: {
    post: {
      body: Joi.object({
        email: Joi.string().email().required(),
        password: Joi.string().min(8).max(200).required(),
      }),
    },
  },
});
