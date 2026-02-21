import { expect, test } from '@playwright/test';

test('redirects unauthenticated users to sign-in', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveURL(/\/auth\/sign-in/);
  await expect(
    page.getByText('By clicking continue, you agree to our')
  ).toBeVisible();
});
