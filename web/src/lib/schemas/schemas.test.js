import { describe, expect, it } from 'vitest';

import { itemSchema, signInSchema, validate } from './index.js';

describe('validate', () => {
  it('returns coerced data on success', () => {
    const result = validate(itemSchema, { name: '  Torquímetro  ' });

    expect(result.success).toBe(true);
    expect(result.data.name).toBe('Torquímetro');
    expect(result.data.status).toBe('draft');
    expect(result.data.tags).toEqual([]);
  });

  it('maps failures to one message per field', () => {
    const result = validate(signInSchema, { email: 'nope', password: '123' });

    expect(result.success).toBe(false);
    expect(result.errors.email).toMatch(/inválido/i);
    expect(result.errors.password).toMatch(/8 caracteres/);
  });

  it('rejects a status outside the allowed set', () => {
    const result = validate(itemSchema, { name: 'ok', status: 'deleted' });

    expect(result.success).toBe(false);
    expect(result.errors.status).toBeTruthy();
  });
});
