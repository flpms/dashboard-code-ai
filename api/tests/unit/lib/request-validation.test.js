import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import Joi from 'joi';

import { JoiValidatorCompiler, validationDetails } from '../../../app/lib/request-validation.js';

const body = Joi.object({
  name: Joi.string().min(2).required(),
  tags: Joi.array().items(Joi.string()).default([]),
});

const compile = schema =>
  JoiValidatorCompiler({ schema, method: 'POST', url: '/items', httpPart: 'body' });

describe('JoiValidatorCompiler', () => {
  it('returns the coerced value, with defaults applied', () => {
    const { value, error } = compile(body)({ name: 'ok' });

    assert.equal(error, undefined);
    assert.deepEqual(value, { name: 'ok', tags: [] });
  });

  it('strips fields nobody declared', () => {
    const { value } = compile(body)({ name: 'ok', role: 'admin' });
    assert.equal(value.role, undefined);
  });

  it('reports every failure, not only the first', () => {
    const { error } = compile(body)({ name: 'x', tags: 'nope' });
    assert.equal(error.details.length, 2);
  });

  it('refuses a schema that is not a Joi object at boot', () => {
    assert.throws(() => compile({}), /body of POST \/items .*forget Joi\.object/);
  });
});

describe('validationDetails', () => {
  it('prefixes each failure with the part of the request that failed', () => {
    const { error } = compile(body)({});
    const tagged = Object.assign(error, { validationContext: 'body' });

    assert.match(validationDetails(tagged)[0], /^body\.name: /);
  });

  it('answers an empty list for an error without details', () => {
    assert.deepEqual(validationDetails(new Error('x')), []);
  });
});
