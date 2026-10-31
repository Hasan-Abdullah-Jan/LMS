import { expect, type Page } from '@playwright/test';

export const PASSWORD = 'Gutech@2026';

export async function login(page: Page, email: string, password = PASSWORD) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

export async function expectNoConsoleErrors(page: Page, run: () => Promise<void>) {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !/Failed to load resource|WebSocket/.test(msg.text()))
      errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));
  await run();
  expect(errors, errors.join('\n')).toEqual([]);
}
