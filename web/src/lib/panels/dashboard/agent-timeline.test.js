import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SESSION_EVENTS, SESSION_START_MS } from '$lib/test-fixtures/session-events.js';
import { buildSessionModel } from '$lib/utils/session-model.js';

import AgentTimeline from './agent-timeline.svelte';

const NOW = SESSION_START_MS + 60_000;
const model = buildSessionModel(SESSION_EVENTS, NOW);

describe('AgentTimeline', () => {
  it('says so when there is nothing to draw', () => {
    render(AgentTimeline, { model: buildSessionModel([], NOW), nowMs: NOW });
    expect(screen.getByText(/Nenhuma atividade/)).toBeInTheDocument();
  });

  it('draws one labelled block per tool call, failures named', () => {
    render(AgentTimeline, { model, nowMs: NOW });

    const blocks = screen.getAllByRole('button');
    expect(blocks).toHaveLength(8);
    expect(screen.getByRole('button', { name: /Grep: TODO, 1 s/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /npm test.*falhou/ })).toBeInTheDocument();
  });

  it('lists in the legend only the categories present', () => {
    render(AgentTimeline, { model, nowMs: NOW });
    const legend = screen.getByRole('list', { name: 'Legenda' });
    expect(legend).toHaveTextContent('Docker');
    expect(legend).not.toHaveTextContent('MCP');
  });

  it('reports the chosen call by click and by keyboard', async () => {
    const onselect = vi.fn();
    const user = userEvent.setup();
    render(AgentTimeline, { model, nowMs: NOW, onselect });

    await user.click(screen.getByRole('button', { name: /Grep/ }));
    screen.getByRole('button', { name: /docker compose/ }).focus();
    await user.keyboard('{Enter}');

    expect(onselect.mock.calls.map(([span]) => span.id)).toEqual(['g1', 'd1']);
  });
});
