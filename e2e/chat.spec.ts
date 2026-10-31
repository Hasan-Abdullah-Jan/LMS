import { expect, test } from '@playwright/test';
import { login } from './helpers';

test('chat: a message from one user appears for another within 2 seconds', async ({ browser }) => {
  const alice = await browser.newPage();
  const bob = await browser.newPage();
  await login(alice, 'fatima.hinai@gutech.demo');
  await login(bob, 'aisha.balushi@gutech.demo');
  await expect(alice).toHaveURL(/\/student$/);
  await expect(bob).toHaveURL(/\/teacher$/);

  const chatUrl = '/chat/44444444-4444-4444-8444-444444444441';
  await alice.goto(chatUrl);
  await bob.goto(chatUrl);
  await expect(bob.getByText('Welcome to the CS101 classroom chat!')).toBeVisible();

  const text = `Realtime check ${Date.now()} <b>not bold</b>`;
  await alice.getByRole('textbox', { name: 'Message' }).fill(text);
  await alice.keyboard.press('Enter');
  // HTML is shown literally, never rendered.
  await expect(bob.getByText(text)).toBeVisible({ timeout: 2_000 });
  await expect(bob.locator('b', { hasText: 'not bold' })).toHaveCount(0);
});
