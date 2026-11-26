import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SESSION_SUMMARY } from '$lib/test-fixtures/session-events.js';

import SessionsList from './sessions-list.svelte';

const NOW = Date.parse(SESSION_SUMMARY.lastEventAt) + 1000;

describe('SessionsList', () => {
  it('explains how to get a first session', () => {
    render(SessionsList, { sessions: [], nowMs: NOW });
    expect(screen.getByText(/hooks:install/)).toBeInTheDocument();
  });

  it('marks a recent session as live and reports the choice', async () => {
    const onselect = vi.fn();
    render(SessionsList, { sessions: [SESSION_SUMMARY], nowMs: NOW, onselect });

    expect(screen.getByText('ao vivo')).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: /repo/ }));
    expect(onselect).toHaveBeenCalledWith(SESSION_SUMMARY);
  });

  it('stops calling a quiet session live', () => {
    render(SessionsList, { sessions: [SESSION_SUMMARY], nowMs: NOW + 10 * 60_000 });
    expect(screen.queryByText('ao vivo')).not.toBeInTheDocument();
  });
});
