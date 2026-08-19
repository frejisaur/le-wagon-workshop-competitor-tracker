import {existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, utimesSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {describe, expect, it} from 'vitest';

const forbidden = [
  {name: 'credential-assignment', pattern: /\b(?:AIRTABLE_PAT|AIRTABLE_BASE_ID|APIFY_TOKEN|CACHE_INVALIDATION_SECRET|airtablePat|airtableBaseId|apifyToken|cacheInvalidationSecret)\b["']?\s*[:=]\s*(?:"(?:\\.|[^"\\])+"|'(?:\\.|[^'\\])+'|[^\s"',;}\]]+)/i},
  {name: 'authorization-bearer', pattern: /\bauthorization\b["']?\s*[:=]\s*(?:"Bearer\s+(?:\\.|[^"\\])+"|'Bearer\s+(?:\\.|[^'\\])+'|Bearer\s+[^\s"',;}\]]+)/i},
  {name: 'bearer-value', pattern: /\b(?:token|apiToken|authorizationToken)\b["']?\s*[:=]\s*(?:"Bearer\s+(?:\\.|[^"\\])+"|'Bearer\s+(?:\\.|[^'\\])+'|Bearer\s+[^\s"',;}\]]+)/i},
  {name: 'provider-fixture-path', pattern: /tests\/fixtures\/providers/i},
  {name: 'raw-provider-object', pattern: /\brawProvider\b/i},
  {name: 'raw-provider-field', pattern: /\b(?:domain_organic|organic_keywords|backlinks_overview)\b/i},
  {name: 'raw-reference-field', pattern: /(?:Observed\s*(?:•\s*)?Raw\s*Ref|rawDatasetRef)/i},
  {name: 'raw-reference-value', pattern: /\bdataset:[A-Za-z0-9._:-]+/i},
  {name: 'airtable-record-id', pattern: /\b(?:id|recordId|airtableRecordId)\b["']?\s*[:=]\s*["']?rec[A-Za-z0-9]{14}\b/i},
];
function scan(root: string): Array<{file: string; detector: string}> {
  const findings: Array<{file: string; detector: string}> = [];
  const walk = (path: string) => {
    for (const name of readdirSync(path)) {
      const child = join(path, name);
      if (statSync(child).isDirectory()) walk(child);
      else {
        const content = readFileSync(child, 'utf8');
        const detector = forbidden.find(({pattern}) => pattern.test(content));
        if (detector) findings.push({file: child, detector: detector.name});
      }
    }
  };
  walk(root);
  return findings;
}

function newestMtime(path: string): number {
  const stat = statSync(path);
  if (!stat.isDirectory()) return stat.mtimeMs;
  return readdirSync(path).reduce((latest, name) => Math.max(latest, newestMtime(join(path, name))), stat.mtimeMs);
}

function assertFreshProductionBuild(buildRoot: string, inputs: string[]): void {
  const buildId = join(buildRoot, 'BUILD_ID');
  const clientRoot = join(buildRoot, 'static');
  if (!existsSync(buildId) || !existsSync(clientRoot)) throw new Error('production browser build is missing');
  const newestInput = Math.max(...inputs.map(newestMtime));
  if (statSync(buildId).mtimeMs < newestInput) throw new Error('production browser build is stale');
}

describe('release secret boundary', () => {
  it('has a working negative control and finds no credential or raw-provider marker in browser artifacts', () => {
    const temp = mkdtempSync(join(tmpdir(), 'ci-secret-negative-'));
    try {
      const sentinels = [
        'AIRTABLE_PAT=sentinel-do-not-ship',
        'Authorization: Bearer sanitized-token-value',
        'const config={"APIFY_TOKEN":"sanitized-property-secret"}',
        'const config={apifyToken:"sanitized-camel-secret"}',
        'const token="Bearer sanitized-standalone-token"',
        'const ref={"Observed • Raw Ref":"sanitized-private-row"}',
        'const raw={rawDatasetRef:"sanitized-item-private"}',
        'const rawValue="dataset:sanitized-private-row"',
        'const record={recordId:"recAbCdEfGhIjKlMn"}',
        'const payload={rawProvider:{domain:"private.example"}}',
        'const payload={domain_organic:{traffic:42}}',
        'const fixture="tests/fixtures/providers/private-payload.json"',
        'const shortConfig={"APIFY_TOKEN":"x"}',
        'const shortHeaders={Authorization:"Bearer y"}',
      ];
      sentinels.forEach((sentinel, index) => writeFileSync(join(temp, `bad-${index}.js`), sentinel));
      writeFileSync(join(temp, 'safe-labels.js'), 'Authorization status; AIRTABLE_PAT is present or missing; Bearer authentication; Raw reference unavailable');
      expect(scan(temp)).toHaveLength(sentinels.length);
      expect(new Set(scan(temp).map(({detector}) => detector))).toEqual(new Set(forbidden.map(({name}) => name)));
      assertFreshProductionBuild('.next', ['app', 'components', 'lib', 'styles', 'next.config.ts', 'package.json', 'package-lock.json']);
      expect(scan('.next/static')).toEqual([]);
    } finally { rmSync(temp, {recursive: true}); }
  });

  it('rejects missing or stale production browser artifacts without exposing matched values', () => {
    const temp = mkdtempSync(join(tmpdir(), 'ci-client-freshness-'));
    try {
      mkdirSync(join(temp, 'build', 'static'), {recursive: true});
      writeFileSync(join(temp, 'build', 'BUILD_ID'), 'sanitized-build');
      writeFileSync(join(temp, 'build', 'static', 'app.js'), 'safe');
      writeFileSync(join(temp, 'source.ts'), 'export const changed = true');
      utimesSync(join(temp, 'build', 'BUILD_ID'), new Date(1_000), new Date(1_000));
      utimesSync(join(temp, 'source.ts'), new Date(2_000), new Date(2_000));
      expect(() => assertFreshProductionBuild(join(temp, 'missing'), [join(temp, 'source.ts')])).toThrow('production browser build is missing');
      expect(() => assertFreshProductionBuild(join(temp, 'build'), [join(temp, 'source.ts')])).toThrow('production browser build is stale');
    } finally { rmSync(temp, {recursive: true}); }
  });

  it('documents only blank server-side credential placeholders and excludes env files from Docker', () => {
    const env = readFileSync('.env.example', 'utf8');
    for (const name of ['AIRTABLE_PAT', 'AIRTABLE_BASE_ID', 'APIFY_TOKEN', 'APIFY_ACTOR_ID', 'CACHE_INVALIDATION_SECRET']) {
      expect(env).toMatch(new RegExp(`^${name}=$`, 'm'));
      expect(env).not.toContain(`NEXT_PUBLIC_${name}`);
    }
    const ignore = readFileSync('.dockerignore', 'utf8');
    expect(ignore).toMatch(/^\.env$/m);
    expect(ignore).toContain('.env.*');
    expect(ignore).toContain('!.env.example');
  });
});
