import { expect, test } from '@playwright/test';
import { expectNoConsoleErrors, login } from './helpers';

test('student: dashboard, submit an assignment, take a quiz, see marks', async ({ page }) => {
  await expectNoConsoleErrors(page, async () => {
    await login(page, 'yousuf.lawati@gutech.demo');
    await expect(page).toHaveURL(/\/student$/);
    await expect(
      page.getByRole('heading', { name: /Good (morning|afternoon|evening), Yousuf/ }),
    ).toBeVisible();

    // Courses -> CS101 -> Assignments -> Lab 2
    await page.getByRole('link', { name: 'My courses' }).click();
    await page.getByRole('link', { name: /Introduction to Programming/ }).click();
    await page.getByRole('link', { name: 'Assignments' }).click();
    await page.getByRole('link', { name: 'Lab 2: Control Flow' }).click();
    await page.getByLabel('Written answer').fill('for i in range(1, 101): print(i)');
    await page.getByRole('button', { name: 'Submit', exact: true }).click();
    await expect(page.getByText(/Submitted .*/).first()).toBeVisible();

    // Quiz 2 (open now)
    await page.goto('/courses/44444444-4444-4444-8444-444444444441/quizzes');
    await page.getByRole('link', { name: 'Quiz 2: Loops and Functions' }).click();
    await page.getByRole('link', { name: 'Start quiz' }).click();
    await expect(page.getByRole('timer')).toBeVisible();
    for (let i = 0; i < 4; i += 1) {
      await page.locator('fieldset label').first().click();
      const next = page.getByRole('button', { name: 'Next' });
      if (await next.isVisible()) await next.click();
    }
    await page.getByRole('button', { name: 'Submit quiz' }).click();
    await page.getByRole('button', { name: 'Submit', exact: true }).click();
    await expect(page.getByText('Your score')).toBeVisible();

    // A second attempt is not possible
    await page.getByRole('link', { name: 'Done' }).click();
    await expect(page.getByRole('link', { name: 'Start quiz' })).toHaveCount(0);

    // Marks
    await page.getByRole('link', { name: 'My marks' }).click();
    await expect(page.getByRole('heading', { name: 'My marks' })).toBeVisible();
    await expect(page.getByText('Lab 1: Hello, Python')).toBeVisible();
  });
});

test('student: raise a complaint and see it listed', async ({ page }) => {
  await login(page, 'maryam.kindi@gutech.demo');
  await page.getByRole('link', { name: 'Complaints' }).click();
  await page.getByRole('button', { name: 'Raise a complaint' }).first().click();
  await page.getByLabel('Category').selectOption('facility');
  await page.getByLabel('Subject').fill('Broken chair in lab');
  await page
    .getByLabel('Description')
    .fill('Chair 14 in lab B-214 has a broken leg and is unsafe.');
  await page.getByRole('button', { name: 'Submit complaint' }).click();
  await expect(page.getByText('Broken chair in lab')).toBeVisible();
});
