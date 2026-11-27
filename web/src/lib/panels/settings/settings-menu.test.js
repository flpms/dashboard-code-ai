import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import SettingsMenu from './settings-menu.svelte';

/** @param {{ installed?: boolean, readable?: boolean }} [hooks] */
const view = ({ installed = false, readable = true } = {}) => ({
  settings: { autoInstallHooks: true, backfillHours: 6 },
  hooks: {
    installed,
    readable,
    url: 'http://127.0.0.1:4317/v1/hooks',
    settingsPath: '/home/dev/.claude/settings.json',
  },
  collector: { version: '0.1.0', host: '127.0.0.1', port: 4317, claudeHome: '/home/dev/.claude' },
  watchers: { docker: true, files: true, security: false, transcripts: true },
});

describe('SettingsMenu', () => {
  it('draws nothing while closed', () => {
    render(SettingsMenu, { open: false, view: view() });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows where the hooks post and offers to install them', async () => {
    const oninstall = vi.fn();
    render(SettingsMenu, { open: true, view: view(), oninstall });

    expect(screen.getByRole('dialog', { name: 'configurações' })).toHaveFocus();
    expect(screen.getByText('não instalados')).toBeInTheDocument();
    expect(screen.getByText('http://127.0.0.1:4317/v1/hooks')).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: /instalar hooks/ }));
    expect(oninstall).toHaveBeenCalled();
  });

  it('offers removal once the hooks are in place', async () => {
    const onremove = vi.fn();
    render(SettingsMenu, { open: true, view: view({ installed: true }), onremove });

    expect(screen.queryByRole('button', { name: /instalar hooks/ })).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: /remover hooks/ }));
    expect(onremove).toHaveBeenCalled();
  });

  it('will not install over a settings file it cannot read', () => {
    render(SettingsMenu, { open: true, view: view({ readable: false }) });
    expect(screen.getByText('settings.json ilegível')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /instalar hooks/ })).toBeDisabled();
  });

  it('sends the form as typed and shows a field error', async () => {
    const onsave = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(SettingsMenu, { open: true, view: view(), onsave });

    await user.click(screen.getByRole('checkbox'));
    await user.clear(screen.getByLabelText(/Recuperar sessões/));
    await user.type(screen.getByLabelText(/Recuperar sessões/), '24');
    await user.click(screen.getByRole('button', { name: 'salvar' }));
    expect(onsave).toHaveBeenCalledWith({ autoInstallHooks: false, backfillHours: 24 });

    await rerender({ errors: { backfillHours: 'No máximo 168 horas (uma semana).' } });
    expect(screen.getByLabelText(/Recuperar sessões/)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText(/No máximo 168 horas/)).toBeInTheDocument();
  });

  it('closes on Escape and on the backdrop', async () => {
    const onclose = vi.fn();
    const user = userEvent.setup();
    render(SettingsMenu, { open: true, view: view(), onclose });

    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Fechar configurações' }));
    expect(onclose).toHaveBeenCalledTimes(2);
  });

  it('reports a failure and a confirmation', () => {
    render(SettingsMenu, {
      open: true,
      view: view(),
      error: 'O settings.json do Claude Code não é um JSON válido.',
      notice: 'Configurações salvas.',
    });
    expect(screen.getByRole('alert')).toHaveTextContent('JSON válido');
    expect(screen.getByRole('status')).toHaveTextContent('Configurações salvas.');
  });
});
