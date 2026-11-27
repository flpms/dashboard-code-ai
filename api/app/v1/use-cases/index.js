'use strict';

import { Collector } from './collector.js';
import { Settings } from './settings.js';

export const UseCases = dependencies => ({
  ...Collector(dependencies),
  ...Settings(dependencies),
});
