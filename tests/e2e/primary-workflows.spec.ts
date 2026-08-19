import {expect, test} from '@playwright/test';

test('shares filters, links map selection to rows, and navigates with workspace persistence', async ({page}) => {
  await page.goto('/');
  await page.getByLabel('Country').selectOption('Canada');
  await expect(page).toHaveURL(/country=Canada/);
  await expect(page.getByRole('row', {name: /Alpha.*alpha\.example/i})).toBeVisible();
  await expect(page.getByRole('row', {name: /Bravo.*bravo\.example/i})).toHaveCount(0);
  await page.reload();
  await expect(page.getByLabel('Country')).toHaveValue('Canada');

  const alphaPoint = page.getByRole('button', {name: /Alpha.*authority 42.*traffic 12,000/i});
  await alphaPoint.click();
  const alphaRow = page.getByRole('row', {name: /Alpha.*alpha\.example/i});
  await expect(alphaRow).toHaveAttribute('aria-selected', 'true');
  await expect(alphaRow).toBeFocused();
  await alphaRow.getByRole('link', {name: 'Alpha'}).click();
  await expect(page).toHaveURL(/\/companies\/alpha/);
  const authorityTab = page.getByRole('tab', {name: 'Authority'});
  await expect.poll(() => authorityTab.evaluate((element) => Object.keys(element).some((key) => key.startsWith('__reactProps')))).toBe(true);
  await authorityTab.click();
  await expect(page).toHaveURL('/companies/alpha?tab=authority');
  await page.getByText('Change company').click();
  await page.getByRole('link', {name: 'View Bravo'}).click();
  await expect(page).toHaveURL('/companies/bravo?tab=authority');
  await expect(page.getByRole('tab', {name: 'Authority'})).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab', {name: /Paid activity/i})).toHaveCount(0);
});

test('provides chart alternatives and an exact battlecard evidence return path', async ({page}) => {
  await page.goto('/companies/alpha');
  await expect(page.getByRole('table', {name: 'Organic traffic historical data'})).toBeVisible();
  await expect(page.getByRole('table', {name: 'Organic traffic historical data'})).toContainText('2026-08-01');
  await page.getByRole('tab', {name: 'Battlecard'}).click();
  await page.getByRole('link', {name: '2 linked observations'}).click();
  await expect(page.getByRole('tab', {name: 'Evidence'})).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('highlighted-evidence')).toHaveCount(2);
  await page.getByRole('button', {name: 'Return to claim'}).click();
  await expect(page.getByTestId('claim-claim-search-strength')).toBeFocused();
});
