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
