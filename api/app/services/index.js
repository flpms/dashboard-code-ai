'use strict';

import { StorageFileService } from './storage-file.service.js';

export const Services = dependencies => ({
  storageFileService: StorageFileService(dependencies),
});
