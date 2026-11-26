'use strict';

import { EventsRepository } from './events.repository.js';
import { SessionsRepository } from './sessions.repository.js';

export const Repositories = ({ db, Logger: logger }) => {
  const deps = { db, logger };

  return {
    eventsRepository: EventsRepository(deps),
    sessionsRepository: SessionsRepository(deps),
  };
};
