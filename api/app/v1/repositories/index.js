'use strict';

import { HistoryRepository } from './history.repository.js';
import { ItemsRepository } from './items.repository.js';
import { UsersRepository } from './users.repository.js';

export const Repositories = ({ db, env, Logger: logger }) => {
  const { collections } = env.db;
  const deps = { db, collections, logger };

  return {
    historyRepository: HistoryRepository(deps),
    itemsRepository: ItemsRepository(deps),
    usersRepository: UsersRepository(deps),
  };
};
