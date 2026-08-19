import {expect, test} from '@playwright/test';

test('keeps primary content inside the viewport at the configured breakpoint', async ({page}) => {
  await page.goto('/');
  const viewport = page.viewportSize()!;
  const dimensions = await page.evaluate(() => ({body: document.body.scrollWidth, html: document.documentElement.scrollWidth}));
  expect(Math.max(dimensions.body, dimensions.html)).toBeLessThanOrEqual(viewport.width);
  await expect(page.getByRole('heading', {name: 'Competitive landscape'})).toBeVisible();
  await expect(page.getByRole('table', {name: 'Company leaderboard'})).toBeVisible();
});

test('uses 44px direct targets on mobile and removes nonessential motion', async ({page}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Mobile-only direct-target check');
  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.goto('/companies/alpha?tab=battlecard');
  for (const target of [page.getByRole('tab', {name: 'Battlecard'}), page.getByRole('link', {name: '2 linked observations'})]) {
    const box = await target.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
  }
  await page.getByRole('link', {name: '2 linked observations'}).click();
  const highlighted = page.getByTestId('highlighted-evidence').first();
  await expect(highlighted).toBeVisible();
  const duration = await highlighted.evaluate((element) => Number.parseFloat(getComputedStyle(element).transitionDuration));
  expect(duration).toBeLessThanOrEqual(0.00001);
  const returnBox = await page.getByRole('button', {name: 'Return to claim'}).boundingBox();
  expect(returnBox?.height).toBeGreaterThanOrEqual(44);
});

test('uses 44px semantic targets for every mobile market-map point', async ({page}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Mobile-only map target check');
  await page.goto('/');
  const points = page.locator('.market-map__point');
  expect(await points.count()).toBeGreaterThan(0);
  for (const point of await points.all()) {
    const box = await point.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);
  }
});

test('contains company tables, workspace tabs, and evidence at the project viewport', async ({page}) => {
  const expectContained = async () => {
    const viewport = page.viewportSize()!;
    const dimensions = await page.evaluate(() => ({body: document.body.scrollWidth, html: document.documentElement.scrollWidth}));
    expect(Math.max(dimensions.body, dimensions.html)).toBeLessThanOrEqual(viewport.width);
  };

  await page.goto('/companies/alpha?tab=search');
  await expect(page.getByRole('table', {name: 'Observed keyword sample'})).toBeVisible();
  await expectContained();
  const tableScroll = page.locator('.company-table__scroll').first();
  const tableBox = await tableScroll.boundingBox();
  expect((tableBox?.x ?? 0) + (tableBox?.width ?? 0)).toBeLessThanOrEqual(page.viewportSize()!.width);
  expect(await tableScroll.evaluate((element) => getComputedStyle(element).overflowX)).toMatch(/auto|scroll/);

  await page.goto('/companies/alpha?tab=evidence');
  await expect(page.getByRole('tab', {name: 'Evidence'})).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('heading', {name: 'Evidence'})).toBeVisible();
  await expectContained();
  const tabs = page.locator('.company-workspace__tabs');
  const tabBox = await tabs.boundingBox();
  expect((tabBox?.x ?? 0) + (tabBox?.width ?? 0)).toBeLessThanOrEqual(page.viewportSize()!.width);
  expect(await tabs.evaluate((element) => getComputedStyle(element).overflowX)).toMatch(/auto|scroll/);
});
