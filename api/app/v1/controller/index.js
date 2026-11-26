'use strict';

import { AuthController } from './auth.controller.js';
import { HealthController } from './health.controller.js';
import { ItemsController } from './items.controller.js';

export const Controllers = deps => ({
  ...AuthController(deps),
  ...HealthController(deps),
  ...ItemsController(deps),
});
