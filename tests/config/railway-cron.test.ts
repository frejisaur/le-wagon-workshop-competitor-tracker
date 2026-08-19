import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';

describe('Railway cron configuration', () => {
  it('keeps web build config separate and defines Railway-only weekly cron execution', () => {
    const shared = readFileSync('railway.toml', 'utf8');
    const cron = readFileSync('railway.cron.toml', 'utf8');
    const docs = readFileSync('docs/operations/deployment.md', 'utf8');

    expect(shared).toMatch(/builder = "DOCKERFILE"/);
    expect(shared).not.toMatch(/cronSchedule|startCommand/);
    expect(cron).toMatch(/dockerfilePath = "Dockerfile"/);
    expect(cron).toMatch(/startCommand = ".*npm run enrich/);
    expect(cron).toMatch(/cronSchedule = "0 15 \* \* 1"/);
    expect(cron).toMatch(/restartPolicyType = "NEVER"/);
    expect(cron).not.toMatch(/apify.*schedule|schedule.*apify/i);
    expect(docs).toMatch(/railway\.cron\.toml/);
    expect(docs).toMatch(/14-minute internal deadline/i);
    expect(docs).toMatch(/creates no Apify\s+schedule/i);
  });
});
