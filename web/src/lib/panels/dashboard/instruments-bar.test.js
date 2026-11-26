import { render, screen, within } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';

import { SESSION_EVENTS, SESSION_START_MS } from '$lib/test-fixtures/session-events.js';
import { buildSessionModel } from '$lib/utils/session-model.js';

import InstrumentsBar from './instruments-bar.svelte';

const model = buildSessionModel(SESSION_EVENTS, SESSION_START_MS + 60_000);

describe('InstrumentsBar', () => {
  it('shows one reading per instrument', () => {
    render(InstrumentsBar, { model, cwd: '/repo' });

    const reading = name => within(screen.getByRole('region', { name }));

    expect(reading('Agentes').getByText('0 ativos')).toBeInTheDocument();
    expect(reading('Containers').getByText('1 de pé')).toBeInTheDocument();
    expect(reading('Containers').getByText('db')).toBeInTheDocument();
    expect(reading('Testes').getByText('10 ✓ · 0 ✗')).toBeInTheDocument();
    expect(reading('Arquivos').getByText('src/app.js')).toBeInTheDocument();
    expect(reading('Recursos').getByText(/code-style/)).toBeInTheDocument();
    expect(reading('Alertas').getByText('nenhum')).toBeInTheDocument();
  });

  it('reads sensibly before anything happened', () => {
    render(InstrumentsBar, { model: buildSessionModel([], 0) });

    expect(screen.getByText('sem execução')).toBeInTheDocument();
    expect(screen.getByText('0 alterados')).toBeInTheDocument();
  });
});
