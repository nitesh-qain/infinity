import { test, expect } from '@playwright/test';

test('P0-SMOKE · Search from homepage', async ({ page }) => {
  // 1. Open the homepage.
  await page.goto('/');

  // 2. Search for "kurti".
  await page.getByRole('link', { name: /search/i }).click();
  const searchBox = page.getByRole('searchbox');
  await searchBox.click();
  await searchBox.fill('kurti');
  await page.keyboard.press('Enter');

  // a. Verify a search results page opens.
  await expect(page).toHaveURL(/\/search\/kurti/i);
  await expect(page.getByRole('heading', { name: /kurti/i })).toBeVisible();

  // b. Verify at least one product card is visible.
  const productCards = page.locator('.prdC');
  await expect(productCards.first()).toBeVisible();
  expect(await productCards.count()).toBeGreaterThan(0);
});
