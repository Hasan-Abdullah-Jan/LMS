import { expect, test } from '@playwright/test';
import { expectNoConsoleErrors, login } from './helpers';

const PDF = Buffer.from('%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << >>\n%%EOF\n');

test('teacher: upload a resource, grade a submission, post an announcement, view gradebook', async ({
  page,
}) => {
  await expectNoConsoleErrors(page, async () => {
    await login(page, 'aisha.balushi@gutech.demo');
    await expect(page).toHaveURL(/\/teacher$/);
    await expect(page.getByText('Grading queue')).toBeVisible();

    // Upload a resource
    await page.goto('/courses/44444444-4444-4444-8444-444444444441/resources');
    await page.getByRole('button', { name: 'Upload resource' }).click();
    await page.getByLabel('Title').fill('Week 4 slides');
    await page
      .locator('#resource-file')
      .setInputFiles({ name: 'week4.pdf', mimeType: 'application/pdf', buffer: PDF });
    await page.getByRole('button', { name: 'Upload', exact: true }).click();
    await expect(page.getByText('Week 4 slides')).toBeVisible();

    // Grade Fatima's Lab 2 submission
    await page.goto('/assignments/55555555-5555-4555-8555-555555555552');
    const marks = page.getByLabel('Marks for Fatima Al-Hinai');
    await marks.fill('18');
    await page.getByLabel('Feedback for Fatima Al-Hinai').fill('Well structured.');
    await page
      .getByRole('row', { name: /Fatima Al-Hinai/ })
      .getByRole('button', { name: 'Save' })
      .click();
    await expect(page.getByText('Saved grade for Fatima Al-Hinai')).toBeVisible();

    // Announcement
    await page.goto('/courses/44444444-4444-4444-8444-444444444441/announcements');
    await page.getByRole('button', { name: 'New announcement' }).click();
    await page.getByLabel('Title').fill('Quiz 3 next week');
    await page.getByLabel('Message').fill('Quiz 3 covers functions and recursion.');
    await page.getByRole('button', { name: 'Post' }).click();
    await expect(page.getByRole('article', { name: 'Quiz 3 next week' })).toBeVisible();

    // Gradebook
    await page.getByRole('link', { name: 'Gradebook' }).click();
    await expect(page.getByRole('rowheader', { name: /Fatima Al-Hinai/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Export CSV' })).toBeVisible();
  });
});
