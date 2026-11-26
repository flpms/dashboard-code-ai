import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import ItemsTable from './items-table.svelte';

const rows = [
  { id: '1', name: 'Torquímetro', status: 'active', createdAt: '2026-03-15T12:00:00.000Z' },
  { id: '2', name: 'Paquímetro', status: 'draft', createdAt: '2026-03-16T12:00:00.000Z' },
];

describe('ItemsTable', () => {
  it('shows an empty state rather than a bare table', () => {
    render(ItemsTable, { items: [] });

    expect(screen.getByText('Nenhum item')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('renders one row per item with a translated status', () => {
    render(ItemsTable, { items: rows });

    expect(screen.getAllByRole('row')).toHaveLength(rows.length + 1);
    expect(screen.getByText('Ativo')).toBeInTheDocument();
  });

  it('reports intent upward instead of acting on its own', async () => {
    const onedit = vi.fn();
    render(ItemsTable, { items: rows, onedit });

    await userEvent.click(screen.getAllByRole('button', { name: 'Editar' })[0]);

    expect(onedit).toHaveBeenCalledWith(rows[0]);
  });
});
