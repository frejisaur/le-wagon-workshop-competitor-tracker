import {execFileSync} from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {expect, test} from '@playwright/test';

function command(script: string, args: string[]): Record<string, unknown> {
  const output = execFileSync('npm', ['run', script, '--', ...args], {
    cwd: process.cwd(), encoding: 'utf8', env: {...process.env, NO_COLOR: '1'},
  });
  const json = output.trim().split('\n').reverse().find((line) => line.startsWith('{'));
  if (!json) throw new Error(`missing sanitized JSON result for ${script}`);
  return JSON.parse(json) as Record<string, unknown>;
}

test('rehearses the fixture-only workshop journey and independent workflow identities', async ({page}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'one deterministic lifecycle rehearsal is sufficient');
  const outputDir = mkdtempSync(join(tmpdir(), 'ci-workshop-e2e-'));
  try {
    const imported = command('import:initial', ['--apollo', 'tests/fixtures/providers/apollo-sample.csv', '--semrush', 'tests/fixtures/providers/semrush-sample.json', '--dry-run']);
    expect(imported).toMatchObject({accepted: 2, rejected: 1, succeeded: 0, failed: 0});
    expect(imported.errors).toEqual([expect.objectContaining({message: 'missing_apollo_website'})]);

    await page.goto('/');
    await page.getByRole('link', {name: 'Alpha', exact: true}).click();
    await expect(page).toHaveURL(/\/companies\/alpha/);
    await expect(page.getByRole('button', {name: /Data current/i})).toBeVisible();
    const battlecardTab = page.getByRole('tab', {name: 'Battlecard'});
    await expect.poll(() => battlecardTab.evaluate((element) => Object.keys(element).some((key) => key.startsWith('__reactProps')))).toBe(true);
    await battlecardTab.click();
    await expect(page.getByText(/Run fixture-run · fixture-harness/)).toBeVisible();
    await page.getByRole('link', {name: '2 linked observations'}).click();
    await expect(page.getByRole('tab', {name: 'Evidence'})).toHaveAttribute('aria-selected', 'true');
    await page.getByRole('button', {name: 'Return to claim'}).click();
    await expect(page.getByTestId('claim-claim-search-strength')).toBeFocused();

    const highPath = join(outputDir, 'high.json');
    const highReplayPath = join(outputDir, 'high-replay.json');
    const high = command('insights:submit', ['tests/fixtures/insights/candidate-high.json', '--fixture-state', 'tests/fixtures/insights/lifecycle-state.json', '--fixture-output-state', highPath]);
    expect(high).toMatchObject({status: 'published', runId: 'fixture-run-high', overallConfidence: 'high', idempotent: false});
    const replay = command('insights:submit', ['tests/fixtures/insights/candidate-high.json', '--fixture-state', highPath, '--fixture-output-state', highReplayPath]);
    expect(replay).toMatchObject({status: 'published', runId: 'fixture-run-high', idempotent: true});

    const lowInputPath = 'tests/fixtures/insights/low-preserves-published-state.json';
    const lowInputBytes = readFileSync(lowInputPath, 'utf8');
    const lowInput = JSON.parse(lowInputBytes) as {insights: Array<{id: string; fields: Record<string, unknown>}>};
    expect(lowInput.insights).toHaveLength(1);
    expect(lowInput.insights[0].fields['Workflow • Evidence Fingerprint']).not.toBe('ce0045d4fc2e0a351988dc56459a65dcd3651e8d475858e3a475af6413b3e656');
    const lowPath = join(outputDir, 'low.json');
    const low = command('insights:submit', ['tests/fixtures/insights/candidate-low-conflicting.json', '--fixture-state', lowInputPath, '--fixture-output-state', lowPath]);
    expect(low).toMatchObject({status: 'queued', runId: 'fixture-run-low', overallConfidence: 'low', reasons: ['conflicting_sources']});

    const approvedPath = join(outputDir, 'approved.json');
    expect(command('insights:publish-approved', ['--fixture-state', 'tests/fixtures/insights/approved-current-state.json', '--fixture-output-state', approvedPath]))
      .toEqual({published: 1, stale: 0, failed: 0, skipped: 0});
    const stalePath = join(outputDir, 'stale.json');
    expect(command('insights:publish-approved', ['--fixture-state', 'tests/fixtures/insights/approved-stale-state.json', '--fixture-output-state', stalePath]))
      .toEqual({published: 0, stale: 1, failed: 0, skipped: 0});

    const snapshots = [highPath, highReplayPath, lowPath, approvedPath, stalePath].map((path) => JSON.parse(readFileSync(path, 'utf8')) as {insights: Array<{fields: Record<string, string>}>; reviews: Array<{fields: Record<string, string>}>});
    expect(snapshots[0].insights.map((row) => row.fields['Identity • Company ID'])).toEqual(snapshots[1].insights.map((row) => row.fields['Identity • Company ID']));
    expect(snapshots[2].reviews).toEqual([expect.objectContaining({fields: expect.objectContaining({'Review • Status': 'needs_review', 'Workflow • Run ID': 'fixture-run-low'})})]);
    expect((snapshots[2] as unknown as {insights: unknown[]}).insights).toEqual(lowInput.insights);
    expect(JSON.stringify((snapshots[2] as unknown as {insights: unknown[]}).insights[0])).toBe(JSON.stringify(lowInput.insights[0]));
    expect(readFileSync(lowInputPath, 'utf8')).toBe(lowInputBytes);
    expect(snapshots[3].reviews[0].fields['Review • Status']).toBe('published');
    expect(snapshots[4].reviews[0].fields['Review • Status']).toBe('stale');
    expect(new Set(['fixture-run', String(high.runId), String(low.runId)]).size).toBe(3);
  } finally {
    rmSync(outputDir, {recursive: true});
  }
});
