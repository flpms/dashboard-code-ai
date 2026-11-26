import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';

import SpanDetails from './span-details.svelte';

const span = {
  id: 't1',
  agentId: 'main',
  name: 'Bash',
  category: 'test',
  summary: 'npm test',
  startMs: Date.parse('2026-11-26T12:00:00.000Z'),
  endMs: Date.parse('2026-11-26T12:00:05.000Z'),
  status: /** @type {const} */ ('error'),
  input: '{"command":"npm test"}',
  output: 'ℹ fail 1',
};

describe('SpanDetails', () => {
  it('invites a click when nothing is selected', () => {
    render(SpanDetails, { span: null, nowMs: 0 });
    expect(screen.getByText(/Clique em um bloco/)).toBeInTheDocument();
  });

  it('shows what the call did, how long it took and how it ended', () => {
    render(SpanDetails, { span, agentLabel: 'principal', nowMs: 0 });

    expect(screen.getByText('falhou')).toBeInTheDocument();
    expect(screen.getByText('5 s')).toBeInTheDocument();
    expect(screen.getByText('principal')).toBeInTheDocument();
    expect(screen.getByText('ℹ fail 1')).toBeInTheDocument();
  });
});
