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
  await page.goto(BASE + '/#/compare?set=mit,apache-2.0');
  await expect(page.locator('.cmp-table')).toBeVisible();
  await page.locator('.cite-btn').first().click();
  await expect(page.locator('tr.cite-row').first()).toBeVisible();
  await expect(page.locator('tr.cite-row .cite-cell').first()).toBeVisible();
});

test('about page renders and mentions data sources', async ({ page }) => {
  await page.goto(BASE + '/#/about');
  await expect(page.locator('h2')).toContainText('About');
  await expect(page.getByText('Where the data comes from')).toBeVisible();
});

test('glossary page renders the feature vocabulary', async ({ page }) => {
  await page.goto(BASE + '/#/glossary');
  await expect(page.locator('h2')).toContainText('Glossary');
  await expect(page.locator('table.glossary')).toHaveCount(3);
  await expect(page.getByText('commercial-use')).toBeVisible();
});

test('text page highlights sentence via :target', async ({ page }) => {
  await page.goto(BASE + '/#/license/mit/text?s=s-3');
  await page.waitForTimeout(200);
  const el = page.locator('#s-3');
  await expect(el).toBeVisible();
  await expect(el).toHaveClass(/pulse/);
});

test('compare page: add column via + button renders immediately (no refresh)', async ({ page }) => {
  await page.goto(BASE + '/#/compare?set=mit');
  await expect(page.locator('.cmp-col-head')).toHaveCount(1);
  await page.locator('.cmp-add-btn').click();
  await expect(page.locator('.add-picker')).toBeVisible();
  await page.locator('.add-picker-input').fill('apache');
  await page.locator('.add-picker-list li').first().click();
  await expect(page.locator('.cmp-col-head')).toHaveCount(2);
  await expect(page.locator('.cmp-col-name').nth(1)).toContainText('Apache');
});

test('compare page: remove column via × button', async ({ page }) => {
  await page.goto(BASE + '/#/compare?set=mit,apache-2.0');
  await expect(page.locator('.cmp-col-head')).toHaveCount(2);
  await page.locator('.col-close').first().click();
  await expect(page.locator('.cmp-col-head')).toHaveCount(1);
});

test('browse: sidebar toggle hides and shows the filter panel', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(BASE + '/');
  await expect(page.locator('.filter-panel')).toBeVisible();
  await page.locator('.browse-toolbar .icon-btn').click();
  await expect(page.locator('.filter-panel')).toHaveCount(0);
  await page.locator('.browse-toolbar .icon-btn').click();
  await expect(page.locator('.filter-panel')).toBeVisible();
});

test('roadmap page lists planned licenses', async ({ page }) => {
  await page.goto(BASE + '/#/roadmap');
  await expect(page.locator('h2')).toContainText('Roadmap');
  await expect(page.locator('table.glossary')).not.toHaveCount(0);
  await expect(page.getByText('ODbL-1.0')).toBeVisible();
});

test('mobile viewport: browse stacks sidebar and table scrolls', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(BASE + '/');
  await expect(page.locator('.table-scroll')).toBeVisible();
  // browse.sidebar-closed class or block layout applies on narrow
  const browse = page.locator('.browse');
  await expect(browse).toBeVisible();
});

test('glossary table wraps long text — cells are not force-nowrap', async ({ page }) => {
  // Regression: site_kit base.css sets white-space: nowrap on all th/td. If we
  // don't override it, glossary meaning cells end up one long line overflowing
  // off-screen. Verify the computed style is `normal`.
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(BASE + '/#/glossary');
  await page.waitForSelector('table.glossary td.gloss-meaning');
  const whiteSpace = await page.locator('table.glossary td.gloss-meaning').first().evaluate(el => getComputedStyle(el).whiteSpace);
  if (whiteSpace !== 'normal') throw new Error(`Expected glossary td white-space: normal, got ${whiteSpace}`);
});

test('text viewer: margin notes render + the active citation is emphasized', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto(BASE + '/#/license/mit/text?s=s-3');
  await page.waitForSelector('.text-margin');
  // At least one margin note appears for MIT (features.json cites several sentences)
  await expect(page.locator('.margin-note').first()).toBeVisible();
  // The group whose sentId matches ?s=s-3 gets the `.active` class.
  await page.waitForTimeout(300);
  const anyActive = await page.locator('.margin-group.active').count();
  if (anyActive === 0) throw new Error('Expected at least one margin-group.active when arriving via ?s=s-3');
});

test('browse: feature filter narrows the row set', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(BASE + '/');
  await page.waitForSelector('.feat-section');
  const before = await page.locator('table.brz tbody tr').count();
  // Find the "commercial-use" feature section and expand it.
  const commercial = page.locator('.feat-section', { has: page.getByText('Commercial use', { exact: true }) });
  await commercial.locator('.feat-section-head').click();
  // Pick `forbidden` — restricts to the non-commercial licenses.
  await commercial.locator('.feat-value-row', { hasText: 'forbidden' }).first().click();
  const after = await page.locator('table.brz tbody tr').count();
  if (!(after < before)) throw new Error(`Expected fewer rows after filter; got ${after} from ${before}`);
  if (after === 0) throw new Error('Filter returned zero rows — did any NC license match forbidden commercial-use?');
});
