import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');
const refreshOnly = ['APIFY_TOKEN', 'APIFY_ACTOR_ID', 'APP_BASE_URL'];

describe('GitHub Actions deployment contracts', () => {
  it('runs one terminating, non-overlapping weekly refresh executed only by GitHub Actions', () => {
    const refresh = read('.github/workflows/refresh.yml');
    expect(refresh).toMatch(/cron: '0 15 \* \* 1'/);
    expect(refresh).toMatch(/workflow_dispatch:/);
    expect(refresh).toMatch(/timeout-minutes: 15/);
    expect(refresh).toMatch(/concurrency:\s*\n\s*group: refresh\s*\n\s*cancel-in-progress: false/);
    expect(refresh).toMatch(/permissions:\s*\n\s*contents: read/);
    expect(refresh).toMatch(/node-version: 22/);
    // tee keeps the report for the run page; the explicit bash shell turns on pipefail so tee cannot mask a failure.
    expect(refresh).toMatch(/- run: npm run --silent enrich \| tee "\$RUNNER_TEMP\/refresh-report.json"\n\s+shell: bash$/m);
    expect(refresh).toMatch(/- if: always\(\)\n\s+run: npm run --silent refresh:report -- "\$RUNNER_TEMP\/refresh-report.json"$/m);
    const config = refresh.split('\n').filter((line) => !line.trimStart().startsWith('#')).join('\n');
    expect(config).not.toMatch(/apify.*schedule|schedule.*apify/i);
  });

  it('reads secrets only from the Actions secret store and never inlines a value', () => {
    const refresh = read('.github/workflows/refresh.yml');
    for (const secret of ['AIRTABLE_PAT', 'APIFY_TOKEN', 'CACHE_INVALIDATION_SECRET']) {
      expect(refresh).toContain(`${secret}: \${{ secrets.${secret} }}`);
    }
    const envBlock = refresh.slice(refresh.indexOf('    env:'), refresh.indexOf('    steps:'));
    for (const line of envBlock.split('\n').slice(1).filter(Boolean)) {
      expect(line).toMatch(/^\s+[A-Z_]+: \$\{\{ (secrets|vars)\.[A-Z_]+ \}\}$/);
    }
    expect(refresh).not.toMatch(/NEXT_PUBLIC_|echo \$|printenv/);
  });

  it('gates releases on build, tests, types, and the schema reference check', () => {
    const ci = read('.github/workflows/ci.yml');
    expect(ci).toMatch(/npm run build[\s\S]*npm test[\s\S]*tsc --noEmit[\s\S]*verify-semrush-schema-reference/);
    expect(ci).not.toMatch(/secrets\./);
  });

  it('documents the web and refresh credential boundary by name only', () => {
    const deployment = read('docs/operations/deployment.md');
    expect(deployment).toContain('npm run enrich');
    expect(deployment).toContain('0 15 * * 1');
    expect(deployment).toMatch(/present.*missing/i);
    expect(deployment).toMatch(/14-minute internal deadline/i);
    expect(deployment).toMatch(/creates no Apify\s+schedule/i);
    for (const name of refreshOnly) expect(deployment).toMatch(new RegExp(`Vercel must not receive[^\\n]*${name}`));
    expect(deployment).not.toMatch(/echo \$|printenv|railway/i);
  });
});
