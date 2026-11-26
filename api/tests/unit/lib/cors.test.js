import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { CorsOptions } from '../../../app/lib/cors.js';
import { fakeLogger } from '../../helpers/fakes.js';

const optionsFor = (corsAllowedOrigins, env = 'development', Logger = fakeLogger()) =>
  CorsOptions({ env: { app: { corsAllowedOrigins, env } }, Logger });

describe('CorsOptions', () => {
  it('allows exactly the listed origins', () => {
    assert.deepEqual(optionsFor('https://a.example, https://b.example').origin, [
      'https://a.example',
      'https://b.example',
    ]);
  });

  it('refuses every origin when the list is empty, instead of allowing all', () => {
    assert.deepEqual(optionsFor('').origin, []);
    assert.deepEqual(optionsFor(undefined).origin, []);
  });

  it('warns when production allows any origin', () => {
    const Logger = fakeLogger();
    assert.equal(optionsFor('*', 'production', Logger).origin, '*');
    assert.equal(Logger.lines.warn.length, 1);
  });
});
