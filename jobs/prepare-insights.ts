import {pathToFileURL} from 'node:url';
import {AirtableClient} from '@/lib/airtable/client';
import {FixtureCompetitorRepository} from '@/lib/airtable/fixture-repository';
import {AirtableCompetitorRepository} from '@/lib/airtable/repository';
import type {CompetitorStore} from '@/lib/airtable/types';
import {getWebEnv} from '@/lib/config/server-env';
import {prepareInsights, type PrepareInsightsOptions} from '@/lib/agents/manifests/prepare';
import {PreparedManifestSchema, validatePreparedLimit, type PreparedManifest} from '@/lib/agents/types';

type CliArguments = {due: boolean; limit?: number; companyId?: string; fixtureState?: string};

function parseArguments(arguments_: string[]): CliArguments {
  let due = false;
  let limit: number | undefined;
  let companyId: string | undefined;
  let fixtureState: string | undefined;
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === '--due') {
      due = true;
      continue;
    }
    if (argument === '--limit' || argument === '--company-id' || argument === '--fixture-state') {
      const value = arguments_[index + 1];
      if (!value || value.startsWith('--')) throw new TypeError('invalid prepare-insights arguments');
      if (argument === '--limit') {
        const parsed = Number(value);
        limit = validatePreparedLimit(parsed);
      }
      if (argument === '--company-id') companyId = value;
      if (argument === '--fixture-state') fixtureState = value;
      index += 1;
      continue;
    }
    throw new TypeError('invalid prepare-insights arguments');
  }
  return {due, limit, companyId, fixtureState};
}

export type PrepareInsightsCliResult = {exitCode: number; stdout: string};
type CliDependencies = {prepare?: (options: PrepareInsightsOptions) => Promise<PreparedManifest>; repository?: CompetitorStore};

/** Emits one sanitized, validated manifest; fixture mode never calls the Airtable network boundary. */
export async function runPrepareInsightsCli(arguments_: string[], dependencies: CliDependencies = {}): Promise<PrepareInsightsCliResult> {
  try {
    const argumentsParsed = parseArguments(arguments_);
    const repository = dependencies.repository ?? (argumentsParsed.fixtureState
      ? FixtureCompetitorRepository.fromSnapshot(argumentsParsed.fixtureState)
      : (() => {
        const env = getWebEnv();
        return new AirtableCompetitorRepository(new AirtableClient({baseId: env.AIRTABLE_BASE_ID, apiToken: env.AIRTABLE_PAT}));
      })());
    const manifest = await (dependencies.prepare ?? prepareInsights)({due: argumentsParsed.due, limit: argumentsParsed.limit, companyId: argumentsParsed.companyId, repository});
    return {exitCode: 0, stdout: JSON.stringify(PreparedManifestSchema.parse(manifest))};
  } catch {
    return {exitCode: 1, stdout: JSON.stringify({status: 'failed', error: 'insight_prepare_failed'})};
  }
}

async function main(): Promise<void> {
  const result = await runPrepareInsightsCli(process.argv.slice(2));
  process.stdout.write(`${result.stdout}\n`);
  process.exitCode = result.exitCode;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) void main();
