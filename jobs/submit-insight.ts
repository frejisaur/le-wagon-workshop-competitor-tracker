import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {AirtableClient} from '@/lib/airtable/client';
import {FixtureCompetitorRepository} from '@/lib/airtable/fixture-repository';
import {AirtableCompetitorRepository} from '@/lib/airtable/repository';
import {getWebEnv} from '@/lib/config/server-env';
import {submitInsightCandidate, type SubmissionResult} from '@/lib/agents/publication/submit';
import type {CompetitorStore} from '@/lib/airtable/types';

type Args = {candidatePath: string; fixtureState?: string};
type Dependencies = {repository?: CompetitorStore; submit?: (candidate: unknown, options: {repository: CompetitorStore}) => Promise<SubmissionResult>};

function parseArgs(args: string[]): Args {
  let candidatePath: string | undefined;
  let fixtureState: string | undefined;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--fixture-state') {
      const value = args[index + 1];
      if (!value || value.startsWith('--')) throw new TypeError('invalid submit-insight arguments');
      fixtureState = value;
      index += 1;
    } else if (!candidatePath && !arg.startsWith('--')) candidatePath = arg;
    else throw new TypeError('invalid submit-insight arguments');
  }
  if (!candidatePath) throw new TypeError('candidate file is required');
  return {candidatePath, fixtureState};
}

/** Safe command boundary: only a short typed outcome can reach stdout. */
export async function runSubmitInsightCli(args: string[], dependencies: Dependencies = {}): Promise<{exitCode: number; stdout: string}> {
  try {
    const parsed = parseArgs(args);
    const candidate: unknown = JSON.parse(readFileSync(parsed.candidatePath, 'utf8'));
    const repository = dependencies.repository ?? (parsed.fixtureState
      ? FixtureCompetitorRepository.fromSnapshot(parsed.fixtureState)
      : (() => { const env = getWebEnv(); return new AirtableCompetitorRepository(new AirtableClient({baseId: env.AIRTABLE_BASE_ID, apiToken: env.AIRTABLE_PAT})); })());
    const result = await (dependencies.submit ?? submitInsightCandidate)(candidate, {repository});
    return {exitCode: result.outcome === 'failed' ? 1 : 0, stdout: JSON.stringify(result)};
  } catch {
    return {exitCode: 1, stdout: JSON.stringify({outcome: 'failed', error: 'insight_submit_failed'})};
  }
}

async function main(): Promise<void> {
  const result = await runSubmitInsightCli(process.argv.slice(2));
  process.stdout.write(`${result.stdout}\n`);
  process.exitCode = result.exitCode;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) void main();
