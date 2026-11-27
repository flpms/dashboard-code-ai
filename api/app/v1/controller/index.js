'use strict';

import { CollectorController } from './collector.controller.js';
import { HealthController } from './health.controller.js';
import { SettingsController } from './settings.controller.js';

export const Controllers = deps => ({
  ...CollectorController(deps),
  ...HealthController(deps),
  ...SettingsController(deps),
});
