'use strict';

/**
 * What the client is told. Deliberately vague on 5xx: the detail belongs in the
 * log, not in a response body a stranger can read.
 */
export const HTTP_MESSAGES = Object.freeze({
  BAD_REQUEST: 'Bad Request',
  UNAUTHORIZED: 'Not authorized',
  FORBIDDEN: 'Forbidden',
  NOT_FOUND: 'Not found',
  CONFLICT: 'Already exists',
  UNPROCESSABLE: 'Could not process the request',
  UNHANDLED_ERROR: 'Internal Server Error',
  SERVICE_UNAVAILABLE: 'Service temporarily unavailable',
});
