import { expect, test } from '@playwright/test';

test.describe('login', () => {
  test('sends an anonymous visitor to the login screen', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('validates in the browser before calling the API', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel('E-mail').fill('not-an-email');
    await page.getByLabel('Senha').fill('123');
    await page.getByRole('button', { name: 'Entrar' }).click();

    await expect(page.getByText(/E-mail inválido/)).toBeVisible();
    await expect(page.getByText(/8 caracteres/)).toBeVisible();
  });

  test('shows the API failure instead of a blank screen', async ({ page }) => {
    await page.route('**/v1/auth/token', route =>
      route.fulfill({ status: 401, body: JSON.stringify({ message: 'Not authorized' }) })
    );

    await page.goto('/login');
    await page.getByLabel('E-mail').fill('user@example.com');
    await page.getByLabel('Senha').fill('supersecret');
    await page.getByRole('button', { name: 'Entrar' }).click();

    await expect(page.getByRole('alert')).toContainText('Not authorized');
  });
});
