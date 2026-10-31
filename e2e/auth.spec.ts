import { expect, test } from '@playwright/test';
import { login } from './helpers';

test.describe('Authentication', () => {
  test('protected routes redirect to /login when signed out', async ({ page }) => {
    await page.goto('/marks');
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  });

  test('invalid credentials show the generic error', async ({ page }) => {
    await login(page, 'fatima.hinai@gutech.demo', 'definitely-wrong');
    await expect(page.getByRole('alert')).toHaveText('Invalid email or password.');
  });

  test('there is no sign-up page or link', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByText(/sign up|register|create an account/i)).toHaveCount(0);
    await page.goto('/signup');
    await expect(page.getByText('Page not found')).toBeVisible();
  });

  test('each role lands on its own dashboard', async ({ page }) => {
    await login(page, 'aisha.balushi@gutech.demo');
    await expect(page).toHaveURL(/\/teacher$/);
    await page.getByRole('button', { name: 'Account menu' }).click();
    await page.getByRole('menuitem', { name: 'Sign out' }).click();
    await login(page, 'admin@gutech.demo');
    await expect(page).toHaveURL(/\/admin$/);
  });

  test('a temporary password forces a password change first', async ({ page }) => {
    await login(page, 'noor.saadi@gutech.demo');
    await expect(page).toHaveURL(/\/change-password$/);
    await expect(page.getByRole('heading', { name: 'Set your own password' })).toBeVisible();
  });
});
