'use strict';

import routesJSON from './routes.json' with { type: 'json' };

import { Controllers } from './controller/index.js';
import { RequireLoopback } from './guards/loopback.hook.js';
import { Repositories } from './repositories/index.js';
import { Schemas } from './schemas/index.js';
import { Serializers } from './serializers/index.js';
import { UseCases } from './use-cases/index.js';

/**
 * Version 1 of the API, as a Fastify plugin mounted under `/v1`.
 *
 * Wiring, in dependency order. Each layer receives the one below it already
 * built — repositories know nothing of use cases, use cases know nothing of
 * HTTP, controllers know nothing of SQLite.
 *
 * The watchers are started here because this is where the use cases they feed
 * exist; they stop with the server, so a test that closes the app leaves no
 * child process or file handle behind.
 */
export const RoutesV1 = deps => async app => {
  const { routeProcessor, services, ...dependencies } = deps;

  const repositories = Repositories(dependencies);

  const useCases = UseCases({
    ...dependencies,
    repositories,
    serializers: Serializers,
    services,
  });

  services.dockerWatcher.start(useCases.recordDockerLine);
  services.fileWatcher.start(useCases.recordFileChange);
  services.securityAuditor.start(useCases.recordAudit);
  services.transcriptWatcher.start(useCases.recordTranscriptEntry, {
    isKnownSession: useCases.isKnownSession,
  });

  app.addHook('onClose', async () => {
    services.dockerWatcher.stop();
    services.fileWatcher.stopAll();
    services.securityAuditor.stop();
    await services.transcriptWatcher.stop();
  });

  routeProcessor({
    ...dependencies,
    app,
    controllers: Controllers({ ...dependencies, ...useCases }),
    requireLoopback: RequireLoopback(dependencies),
    schemas: Schemas(dependencies),
  })(routesJSON);
};
