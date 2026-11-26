'use strict';

import { CollectorController } from './collector.controller.js';
import { HealthController } from './health.controller.js';

export const Controllers = deps => ({
  ...CollectorController(deps),
  ...HealthController(deps),
});
