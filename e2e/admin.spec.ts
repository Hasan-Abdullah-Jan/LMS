import { expect, test } from '@playwright/test';
import { expectNoConsoleErrors, login } from './helpers';

test('admin: create a user and a course, assign a teacher, enroll a student, review a complaint', async ({
  page,
}) => {
  const suffix = Date.now().toString(36).slice(-5);
  await expectNoConsoleErrors(page, async () => {
    await login(page, 'admin@gutech.demo');
    await expect(page).toHaveURL(/\/admin$/);

    // Create a student account
    await page.getByRole('link', { name: 'Users' }).click();
    await page.getByRole('button', { name: 'Create user' }).click();
    await page.getByLabel('Full name').fill(`E2E Student ${suffix}`);
    await page.getByLabel('Email').fill(`e2e.${suffix}@gutech.demo`);
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByText('Account created')).toBeVisible();

    // Create a course
    await page.getByRole('link', { name: 'Courses' }).click();
    await page.getByRole('button', { name: 'Create course' }).first().click();
    await page.getByLabel('Code').fill(`E2E${suffix}`.toUpperCase().slice(0, 16));
    await page.getByLabel('Title').fill('End-to-end Testing');
    await page.getByRole('button', { name: 'Create course' }).last().click();
    await expect(page.getByRole('heading', { name: /End-to-end Testing/ })).toBeVisible();

    // Enroll the new student
    await page.getByRole('checkbox', { name: `E2E Student ${suffix}` }).click();
    await page.getByRole('button', { name: /Enroll 1/ }).click();
    await expect(page.getByText('1 student(s) enrolled')).toBeVisible();

    // Assign a teacher
    await page.getByRole('tab', { name: /Teachers/ }).click();
    await page.getByRole('checkbox', { name: 'Dr. Omar Al-Rawahi' }).click();
    await page.getByRole('button', { name: /Save teachers/ }).click();
    await expect(page.getByText('Teachers updated')).toBeVisible();

    // Review a complaint
    await page.getByRole('link', { name: 'Complaints' }).click();
    await page.getByRole('button', { name: 'Wi-Fi drops in the library' }).click();
    await page.getByRole('button', { name: 'Start review' }).click();
    await expect(page.getByText('Complaint in review')).toBeVisible();
  });
});
