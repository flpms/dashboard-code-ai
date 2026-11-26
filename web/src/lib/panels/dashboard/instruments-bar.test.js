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

    const tile = name => screen.getByRole('region', { name });

    expect(tile('Agentes')).toHaveTextContent(/0\s*ativos de/);
    expect(tile('Containers')).toHaveTextContent(/1\s*de pé/);
    expect(reading('Containers').getByText('db')).toBeInTheDocument();
    expect(tile('Testes')).toHaveTextContent(/10\s*passaram · 0 falharam/);
    expect(reading('Arquivos').getByText('src/app.js')).toBeInTheDocument();
    expect(reading('Recursos').getByText(/code-style/)).toBeInTheDocument();
    expect(tile('Alertas')).toHaveTextContent(/^alertas\s*1/i);
  });

  it('shows the dependency audit and links only to https advisories', () => {
    render(InstrumentsBar, { model, cwd: '/repo' });

    const security = within(screen.getByRole('region', { name: 'Segurança' }));
    expect(screen.getByRole('region', { name: 'Segurança' })).toHaveTextContent(/2\s*vulnerab\./);

    const safe = security.getByText(/minimist: Prototype Pollution/);
    const unsafe = security.getByText(/lodash: Command Injection/);
    expect(safe).toHaveAttribute('href', 'https://github.com/advisories/GHSA-xvch-5gv4-984h');
    expect(unsafe).not.toHaveAttribute('href');
  });

  it('reads sensibly before anything happened', () => {
    render(InstrumentsBar, { model: buildSessionModel([], 0) });

    expect(screen.getByText('sem execução')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Arquivos' })).toHaveTextContent(/0\s*alterados/);
    expect(screen.getByText('sem auditoria')).toBeInTheDocument();
  });
});
