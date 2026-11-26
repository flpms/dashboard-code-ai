import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { DBStartup } from '../../app/config/db.config.js';
import { enums } from '../../app/enums/index.js';
import { EventBus } from '../../app/lib/event-bus.js';
import { Repositories } from '../../app/v1/repositories/index.js';
import { Serializers } from '../../app/v1/serializers/index.js';
import { Collector } from '../../app/v1/use-cases/collector.js';
import { fakeClock, fakeFileWatcher, fakeLogger } from './fakes.js';

/**
 * A collector over a real in-memory SQLite database. SQLite ships with Node, so
 * this needs no server and no mock — the SQL the tests exercise is the SQL
 * production runs.
 */
export const buildCollector = () => {
  const Logger = fakeLogger();
  const { db } = DBStartup({
    env: { db: { path: ':memory:' } },
    logger: Logger,
    DatabaseSync,
    mkdirSync: () => {},
    dirname,
  });
  const clock = fakeClock();
  const eventBus = EventBus();
  const fileWatcher = fakeFileWatcher();
  const published = [];
  eventBus.subscribe(event => published.push(event));

  const deps = { db, enums, eventBus, Logger, clock };
  const collector = Collector({
    ...deps,
    repositories: Repositories(deps),
    serializers: Serializers,
    services: { fileWatcher },
  });

  return { collector, clock, db, fileWatcher, Logger, published };
};
