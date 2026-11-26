import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { GenerateSchemaObject } from '../../../app/lib/generate-schema-object.js';

const empty = () => ({ delete: {}, get: {}, patch: {}, post: {} });

describe('GenerateSchemaObject', () => {
  it('re-indexes route-first schemas by HTTP method', () => {
    const result = GenerateSchemaObject([
      { createItem: { post: { body: 'B' } } },
      { getItem: { get: { params: 'P' } } },
    ])(empty());

    assert.deepEqual(result.post.createItem, { body: 'B' });
    assert.deepEqual(result.get.getItem, { params: 'P' });
  });

  it('refuses two schemas claiming the same route and method', () => {
    assert.throws(
      () => GenerateSchemaObject([{ getItem: { get: {} } }, { getItem: { get: {} } }])(empty()),
      /Duplicate schema for get "getItem"/
    );
  });

  it('refuses a method the router does not support', () => {
    assert.throws(
      () => GenerateSchemaObject([{ getItem: { trace: {} } }])(empty()),
      /unsupported method "trace"/
    );
  });
});
