'use strict';

import {
  serializeEvent,
  serializeEventList,
  serializeSession,
  serializeSessionList,
} from './event.serializer.js';
import { serializeSettings } from './settings.serializer.js';

export const Serializers = Object.freeze({
  serializeEvent,
  serializeEventList,
  serializeSession,
  serializeSessionList,
  serializeSettings,
});
