'use strict';

import { Collector } from './collector.js';

export const UseCases = dependencies => ({
  ...Collector(dependencies),
});
