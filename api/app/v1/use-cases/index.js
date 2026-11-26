'use strict';

import { Auth } from './auth.js';
import { Items } from './items.js';

export const UseCases = dependencies => ({
  ...Auth(dependencies),
  ...Items(dependencies),
});
