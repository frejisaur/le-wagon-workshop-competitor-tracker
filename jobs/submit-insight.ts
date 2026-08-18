import {mkdirSync, readFileSync, renameSync, writeFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {AirtableClient} from '@/lib/airtable/client';
import {FixtureCompetitorRepository} from '@/lib/airtable/fixture-repository';
import {AirtableCompetitorRepository} from '@/lib/airtable/repository';
import {getWebEnv} from '@/lib/config/server-env';
import {submitInsightCandidate, type SubmissionResult} from '@/lib/agents/publication/submit';
import type {CompetitorStore} from '@/lib/airtable/types';

type Args = {candidatePath: string; fixtureState?: string; fixtureOutputState?: string};
type Dependencies = {repository?: CompetitorStore; submit?: (candidate: unknown, options: {repository: CompetitorStore}) => Promise<SubmissionResult>};

function parseArgs(args: string[]): Args {
  let candidatePath: string | undefined;
  let fixtureState: string | undefined;
  let fixtureOutputState: string | undefined;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--fixture-state' || arg === '--fixture-output-state') {
      const value = args[index + 1];
      if (!value || value.startsWith('--')) throw new TypeError('invalid submit-insight arguments');
      if (arg === '--fixture-state') fixtureState = value;
      else fixtureOutputState = value;
      index += 1;
    } else if (!candidatePath && !arg.startsWith('--')) candidatePath = arg;
    else throw new TypeError('invalid submit-insight arguments');
  }
  if (!candidatePath) throw new TypeError('candidate file is required');
  if (fixtureOutputState && (!fixtureState || resolve(fixtureOutputState) === resolve(fixtureState))) throw new TypeError('invalid_fixture_output_state');
  return {candidatePath, fixtureState, fixtureOutputState};
}

function fixtureFailure(reason: string) { return {exitCode: 1, stdout: JSON.stringify({status: 'rejected', companyId: 'unknown', runId: 'unknown', reasons: [reason]})}; }

function writeFixtureState(path: string, repository: FixtureCompetitorRepository): void {
  mkdirSync(dirname(path), {recursive: true});
  const temporary = `${path}.tmp-${process.pid}`;
  writeFileSync(temporary, `${JSON.stringify(repository.toSnapshot(), null, 2)}\n`, {mode: 0o600});
  renameSync(temporary, path);
}

/** Safe command boundary: only a short typed outcome can reach stdout. */
export async function runSubmitInsightCli(args: string[], dependencies: Dependencies = {}): Promise<{exitCode: number; stdout: string}> {
  try {
    const parsed = parseArgs(args);
    const candidate: unknown = JSON.parse(readFileSync(parsed.candidatePath, 'utf8'));
    const fixtureRepository = !dependencies.repository && parsed.fixtureState ? FixtureCompetitorRepository.fromSnapshot(parsed.fixtureState) : undefined;
    const repository = dependencies.repository ?? fixtureRepository ?? (
      () => { const env = getWebEnv(); return new AirtableCompetitorRepository(new AirtableClient({baseId: env.AIRTABLE_BASE_ID, apiToken: env.AIRTABLE_PAT})); })();
    const result = await (dependencies.submit ?? submitInsightCandidate)(candidate, {repository});
    if (fixtureRepository && parsed.fixtureOutputState) writeFixtureState(parsed.fixtureOutputState, fixtureRepository);
    return {exitCode: result.status === 'rejected' ? 1 : 0, stdout: JSON.stringify(result)};
  } catch {
    return fixtureFailure('invalid_fixture_output_state');
  }
}

async function main(): Promise<void> {
  const result = await runSubmitInsightCli(process.argv.slice(2));
  process.stdout.write(`${result.stdout}\n`);
  process.exitCode = result.exitCode;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) void main();
