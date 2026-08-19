import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {describe, expect, it} from 'vitest';
import {runInitialImportCli} from '@/jobs/import-initial';

const semrush = readFileSync(resolve(process.cwd(), 'tests/fixtures/providers/semrush-sample.json'), 'utf8');
const apollo = [
  'Company Name,Website,Apollo Account Id,Apollo Record Id',
  'Alpha,https://alpha.example,acct-alpha,rec-alpha',
].join('\n');

describe('initial import CLI', () => {
  it('dry-runs an Apollo-only roster as explicitly unenriched', async () => {
    const result = await runInitialImportCli(
      ['--apollo', 'apollo.csv', '--apollo-only', '--dry-run'],
      {readFile: () => apollo},
    );

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      accepted: 1,
      unenriched: 1,
      rejected: 0,
      apifyOnly: 0,
      succeeded: 0,
    });
    expect(result.stdout.split('\n')).toHaveLength(1);
    expect(result.stdout).not.toMatch(/acct-alpha|rec-alpha|https:\/\/alpha\.example/);
  });

  it('requires one provider source mode', async () => {
    const result = await runInitialImportCli(['--apollo', 'apollo.csv', '--dry-run'], {
      readFile: () => { throw new Error('must not read invalid arguments'); },
    });

    expect(result).toEqual({
      exitCode: 1,
      stdout: JSON.stringify({status: 'failed', error: 'initial_import_failed'}),
    });
  });

  it('rejects Apollo-only and Semrush modes together', async () => {
    const result = await runInitialImportCli(
      ['--apollo', 'apollo.csv', '--apollo-only', '--semrush', 'semrush.json', '--dry-run'],
      {readFile: () => { throw new Error('must not read invalid arguments'); }},
    );

    expect(result).toEqual({
      exitCode: 1,
      stdout: JSON.stringify({status: 'failed', error: 'initial_import_failed'}),
    });
  });

  it('exits nonzero with exactly one sanitized JSON summary when every Apollo row is invalid', async () => {
    const result = await runInitialImportCli(['--apollo', 'apollo.csv', '--semrush', 'semrush.json', '--dry-run'], {
      readFile: (path) => path === 'apollo.csv'
        ? 'Company Name,Website,Apollo Account Id,Apollo Record Id\nMissing,,acct-missing,rec-missing\nInvalid,not a domain,acct-invalid,rec-invalid'
        : semrush,
    });

    expect(result.exitCode).toBe(1);
    expect(result.stdout.split('\n')).toHaveLength(1);
    expect(JSON.parse(result.stdout)).toMatchObject({accepted: 0, rejected: 2, succeeded: 0, failed: 0});
    expect(result.stdout).not.toMatch(/acct-|not a domain|Missing Website/i);
  });

  it('exits zero for a recoverable partial report and emits one JSON summary', async () => {
    const result = await runInitialImportCli(['--apollo', 'apollo.csv', '--semrush', 'semrush.json', '--dry-run'], {
      readFile: (path) => path === 'apollo.csv'
        ? 'Company Name,Website,Apollo Account Id,Apollo Record Id\nAlpha,https://alpha.example,acct-alpha,rec-alpha\nMissing,,acct-missing,rec-missing'
        : semrush,
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout.split('\n')).toHaveLength(1);
    expect(JSON.parse(result.stdout)).toMatchObject({accepted: 1, rejected: 1, succeeded: 0, failed: 0});
  });
});
