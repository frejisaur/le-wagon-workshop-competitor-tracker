import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {describe, expect, it} from 'vitest';
import {runInitialImportCli} from '@/jobs/import-initial';

const semrush = readFileSync(resolve(process.cwd(), 'tests/fixtures/providers/semrush-sample.json'), 'utf8');
const apollo = [
  'Company Name,Website,Apollo Account Id,Apollo Record Id',
  'Alpha,https://alpha.example,acct-alpha,rec-alpha',
].join('\n');
const twoCompanyApollo = [
  'Company Name,Website,Apollo Account Id,Apollo Record Id',
  'Alpha,https://alpha.example,acct-alpha,rec-alpha',
  'Beta,https://beta.example,acct-beta,rec-beta',
].join('\n');

const initialImportFailure = {
  exitCode: 1,
  stdout: JSON.stringify({status: 'failed', error: 'initial_import_failed'}),
};

describe('initial import CLI', () => {
  it('dry-runs an Apollo-only roster as explicitly unenriched', async () => {
    const result = await runInitialImportCli(
      ['--apollo', 'apollo.csv', '--apollo-only', '--domains', 'domains.txt', '--dry-run'],
      {readFile: (path) => path === 'apollo.csv' ? apollo : 'www.alpha.example\n'},
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
    expect(result.stdout).not.toContain('www.alpha.example');
    expect(result.stdout).not.toMatch(/acct-alpha|rec-alpha|https:\/\/alpha\.example/);
  });

  it('requires domains in Apollo-only mode', async () => {
    const result = await runInitialImportCli(
      ['--apollo', 'apollo.csv', '--apollo-only', '--dry-run'],
      {readFile: () => { throw new Error('must not read invalid arguments'); }},
    );

    expect(result).toEqual(initialImportFailure);
  });

  it('rejects domains in Semrush mode', async () => {
    const result = await runInitialImportCli(
      ['--apollo', 'apollo.csv', '--semrush', 'semrush.json', '--domains', 'domains.txt', '--dry-run'],
      {readFile: () => { throw new Error('must not read invalid arguments'); }},
    );

    expect(result).toEqual(initialImportFailure);
  });

  it('rejects blank requested-domain input', async () => {
    const result = await runInitialImportCli(
      ['--apollo', 'apollo.csv', '--apollo-only', '--domains', 'domains.txt', '--dry-run'],
      {readFile: (path) => path === 'apollo.csv' ? apollo : '\n  \n'},
    );

    expect(result).toEqual(initialImportFailure);
  });

  it('rejects an invalid requested domain', async () => {
    const result = await runInitialImportCli(
      ['--apollo', 'apollo.csv', '--apollo-only', '--domains', 'domains.txt', '--dry-run'],
      {readFile: (path) => path === 'apollo.csv' ? apollo : 'not a public domain\n'},
    );

    expect(result).toEqual(initialImportFailure);
  });

  it('rejects normalized requested-domain duplicates', async () => {
    const result = await runInitialImportCli(
      ['--apollo', 'apollo.csv', '--apollo-only', '--domains', 'domains.txt', '--dry-run'],
      {readFile: (path) => path === 'apollo.csv' ? apollo : 'www.alpha.example\nalpha.example\n'},
    );

    expect(result).toEqual(initialImportFailure);
  });

  it('rejects an extra requested domain not in the Apollo roster', async () => {
    const result = await runInitialImportCli(
      ['--apollo', 'apollo.csv', '--apollo-only', '--domains', 'domains.txt', '--dry-run'],
      {readFile: (path) => path === 'apollo.csv' ? apollo : 'alpha.example\nunknown.example\n'},
    );

    expect(result).toEqual(initialImportFailure);
  });

  it('rejects an Apollo roster domain omitted from the requested domains', async () => {
    const result = await runInitialImportCli(
      ['--apollo', 'apollo.csv', '--apollo-only', '--domains', 'domains.txt', '--dry-run'],
      {readFile: (path) => path === 'apollo.csv' ? twoCompanyApollo : 'alpha.example\n'},
    );

    expect(result).toEqual(initialImportFailure);
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
