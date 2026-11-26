import { expect, test } from '@playwright/test';

import { SESSION_EVENTS, SESSION_SUMMARY } from '../src/lib/test-fixtures/session-events.js';

/**
 * The built dashboard against a stubbed collector: the session list, the
 * event log and one live event arriving over the stream.
 */

const LIVE_EVENT = {
  ...SESSION_EVENTS.at(-1),
  seq: SESSION_EVENTS.length + 1,
  kind: 'tool.start',
  spanId: 'live-1',
  name: 'Write',
  category: 'edit',
  status: null,
  data: { summary: '/repo/src/new.js', input: '{}' },
};

const stubCollector = async (page, { sessions = [SESSION_SUMMARY] } = {}) => {
  await page.route('**/v1/sessions?*', route => route.fulfill({ json: { sessions } }));
  await page.route('**/v1/sessions/*/events*', route =>
    route.fulfill({ json: { events: SESSION_EVENTS, last: SESSION_EVENTS.length } })
  );
  await page.route('**/v1/stream', route =>
    route.fulfill({
      status: 200,
      headers: { 'content-type': 'text/event-stream', 'access-control-allow-origin': '*' },
      body: `: connected\n\ndata: ${JSON.stringify(LIVE_EVENT)}\n\n`,
    })
  );
};

test.describe('dashboard', () => {
  test('shows the instruments and the agent timeline of the latest session', async ({ page }) => {
    await stubCollector(page);
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1, name: 'repo' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Testes' })).toContainText(
      /10\s*passaram · 0 falharam/
    );
    await expect(page.getByRole('region', { name: 'Containers' })).toContainText('db');
    await expect(page.getByRole('button', { name: /Grep: TODO/ })).toBeVisible();
  });

  test('draws an event that arrives over the stream', async ({ page }) => {
    await stubCollector(page);
    await page.goto('/');

    await expect(page.getByRole('button', { name: /Write: \/repo\/src\/new\.js/ })).toBeVisible();
  });

  test('opens the details of a call from the timeline', async ({ page }) => {
    await stubCollector(page);
    await page.goto('/');

    await page.getByRole('button', { name: /npm test.*falhou/ }).click();

    const details = page.getByRole('region', { name: 'Detalhes da chamada' });
    await expect(details).toContainText('falhou');
    await expect(details).toContainText('ℹ fail 1');
  });

  test('explains how to start when the collector has no session', async ({ page }) => {
    await stubCollector(page, { sessions: [] });
    await page.goto('/');

    await expect(page.getByText(/hooks:install/)).toBeVisible();
  });

  test('says the collector is unreachable instead of showing a blank page', async ({ page }) => {
    await page.route('**/v1/**', route => route.abort());
    await page.goto('/');

    await expect(page.getByRole('alert')).toContainText('Não foi possível falar com o coletor');
  });
});
