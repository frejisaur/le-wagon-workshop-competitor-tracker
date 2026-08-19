import {mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {describe, expect, it} from 'vitest';

const forbidden = [/AIRTABLE_PAT\s*=\s*\S+/i, /APIFY_TOKEN\s*=\s*\S+/i, /CACHE_INVALIDATION_SECRET\s*=\s*\S+/i, /tests\/fixtures\/providers/i, /rawProvider/i];
function scan(root: string): string[] {
  const findings: string[] = [];
  const walk = (path: string) => {
    for (const name of readdirSync(path)) {
      const child = join(path, name);
      if (statSync(child).isDirectory()) walk(child);
      else if (forbidden.some((pattern) => pattern.test(readFileSync(child, 'utf8')))) findings.push(child);
    }
  };
  walk(root);
  return findings;
}

describe('release secret boundary', () => {
  it('has a working negative control and finds no credential or raw-provider marker in browser artifacts', () => {
    const temp = mkdtempSync(join(tmpdir(), 'ci-secret-negative-'));
    try {
      writeFileSync(join(temp, 'bad.js'), 'AIRTABLE_PAT=sentinel-do-not-ship');
      expect(scan(temp)).toHaveLength(1);
      expect(scan('.next/static')).toEqual([]);
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
