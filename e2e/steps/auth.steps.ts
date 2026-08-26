import { expect } from '@playwright/test';
import { Given, When, Then } from './fixtures';
import { DEV_USER_PASSWORDS } from '../support/dev-users';

Given('I am on the sign-in page', async ({ page }) => {
  await page.goto('/');
});

When('I visit {string}', async ({ page }, path: string) => {
  await page.goto(path);
});

When('I sign in as {string} with password {string}', async ({ page }, username: string, password: string) => {
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
});

// Prefer this variant in new journeys: specs stay free of credential literals and the
// password resolves from the single support fixture instead.
When('I sign in as {string}', async ({ page }, username: string) => {
  const password = DEV_USER_PASSWORDS[username];
  if (!password) {
    throw new Error(`unknown development user "${username}"; add it to e2e/support/dev-users.ts`);
  }

  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
});

When('I sign out', async ({ page }) => {
  await page.getByRole('button', { name: 'Sign out' }).click();
});

Then('I reach the quote page', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Random quote' })).toBeVisible();
});

Then('I stay on the sign-in page', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
});

Then('an alert explains the problem', async ({ page }) => {
  await expect(page.getByRole('alert')).toBeVisible();
});
