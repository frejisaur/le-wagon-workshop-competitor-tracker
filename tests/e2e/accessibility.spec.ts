import {expect, test} from '@playwright/test';

test('supports skip navigation, polite filter counts, and keyboard map traversal', async ({page}) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', {name: 'Skip to content'})).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
  await expect(page.getByText(/3 companies across the selected market/i)).toHaveAttribute('aria-live', 'polite');

  const alpha = page.getByRole('button', {name: /Alpha.*authority 42/i});
  const bravo = page.getByRole('button', {name: /Bravo.*authority 65/i});
  await alpha.focus();
  await page.keyboard.press('ArrowDown');
  await expect(bravo).toBeFocused();
  await expect(page.getByRole('table', {name: 'Market map accessible data'})).toBeVisible();
});

test('exposes stale evidence state and keyboard-operable workspace tabs', async ({page}) => {
  await page.goto('/companies/charlie?tab=battlecard');
  await expect(page.getByText('Data is stale but remains available.')).toBeVisible();
  await expect(page.getByRole('status', {name: '', exact: true}).filter({hasText: /^Insight stale$/})).toBeVisible();
  const battlecard = page.getByRole('tab', {name: 'Battlecard'});
  await battlecard.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', {name: 'Evidence'})).toBeFocused();
});
