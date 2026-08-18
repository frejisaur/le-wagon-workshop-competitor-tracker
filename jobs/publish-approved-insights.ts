import {pathToFileURL} from 'node:url';
import {AirtableClient} from '@/lib/airtable/client';
import {FixtureCompetitorRepository} from '@/lib/airtable/fixture-repository';
import {AirtableCompetitorRepository} from '@/lib/airtable/repository';
import {getWebEnv} from '@/lib/config/server-env';
import {publishApprovedInsights, type PublishApprovedResult} from '@/lib/agents/publication/publish-approved';
import type {CompetitorStore} from '@/lib/airtable/types';

type Dependencies = {repository?: CompetitorStore; publish?: (options: {repository: CompetitorStore}) => Promise<PublishApprovedResult>};

function parseArgs(args: string[]): {fixtureState?: string} {
  if (args.length === 0) return {};
  if (args.length === 2 && args[0] === '--fixture-state' && args[1] && !args[1].startsWith('--')) return {fixtureState: args[1]};
  throw new TypeError('invalid publish-approved-insights arguments');
}

/** Safe command boundary: fixture mode has no Airtable network access or write-back. */
export async function runPublishApprovedInsightsCli(args: string[], dependencies: Dependencies = {}): Promise<{exitCode: number; stdout: string}> {
  try {
    const parsed = parseArgs(args);
    const repository = dependencies.repository ?? (parsed.fixtureState
      ? FixtureCompetitorRepository.fromSnapshot(parsed.fixtureState)
      : (() => { const env = getWebEnv(); return new AirtableCompetitorRepository(new AirtableClient({baseId: env.AIRTABLE_BASE_ID, apiToken: env.AIRTABLE_PAT})); })());
    const result = await (dependencies.publish ?? publishApprovedInsights)({repository});
    return {exitCode: result.failed ? 1 : 0, stdout: JSON.stringify(result)};
  } catch {
    return {exitCode: 1, stdout: JSON.stringify({status: 'failed', error: 'insight_publish_approved_failed'})};
  }
}

async function main(): Promise<void> {
  const result = await runPublishApprovedInsightsCli(process.argv.slice(2));
  process.stdout.write(`${result.stdout}\n`);
  process.exitCode = result.exitCode;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) void main();
