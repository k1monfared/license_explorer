import { test, expect } from '@playwright/test';

const BASE = process.env.BASE_URL || 'http://localhost:8080';

test('browse page shows at least one license', async ({ page }) => {
  await page.goto(BASE + '/');
  await expect(page.locator('table.brz tbody tr')).not.toHaveCount(0);
});

test('detail page renders for MIT with approval badges', async ({ page }) => {
  await page.goto(BASE + '/#/license/mit');
  await expect(page.locator('h2')).toContainText('MIT');
  await expect(page.locator('.feat-table')).toHaveCount(3);
  await expect(page.locator('.approvals-row .approval-badge')).not.toHaveCount(0);
});

test('compare page renders with citation expand', async ({ page }) => {
  await page.goto(BASE + '/#/compare?set=mit');
  await expect(page.locator('.cmp-table')).toBeVisible();
  await page.locator('.cite-btn').first().click();
  await expect(page.locator('.cite-expanded')).toBeVisible();
});

test('text page highlights sentence via :target', async ({ page }) => {
  await page.goto(BASE + '/#/license/mit/text?s=s-3');
  await page.waitForTimeout(200);
  const el = page.locator('#s-3');
  await expect(el).toBeVisible();
  await expect(el).toHaveClass(/pulse/);
});
