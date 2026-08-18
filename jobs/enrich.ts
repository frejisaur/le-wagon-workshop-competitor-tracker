import {readFileSync, writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {AirtableClient} from '@/lib/airtable/client';
import {FixtureCompetitorRepository} from '@/lib/airtable/fixture-repository';
import {AirtableCompetitorRepository} from '@/lib/airtable/repository';
import {ApifyClient} from '@/lib/apify/client';
import {runDomainOverview} from '@/lib/apify/run-domain-overview';
import {getRefreshEnv} from '@/lib/config/server-env';
import {parseSemrushPayload} from '@/lib/schemas/semrush';
import {runEnrichment, type EnrichmentReport} from '@/lib/workflows/enrich';

type CliArguments = {providerFixture?: string; fixtureState?: string; outputState?: string; actorId?: string};

function parseArguments(arguments_: string[]): CliArguments {
  const parsed: CliArguments = {};
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (!['--provider-fixture', '--fixture-state', '--output-state', '--actor-id'].includes(argument)) throw new TypeError(`unsupported argument: ${argument}`);
    const value = arguments_[index + 1];
    if (!value || value.startsWith('--')) throw new TypeError(`${argument} requires a file path or actor ID`);
    if (argument === '--provider-fixture') parsed.providerFixture = value;
    if (argument === '--fixture-state') parsed.fixtureState = value;
    if (argument === '--output-state') parsed.outputState = value;
    if (argument === '--actor-id') parsed.actorId = value;
    index += 1;
  }
  if (parsed.providerFixture && !parsed.fixtureState) throw new TypeError('--provider-fixture requires --fixture-state');
  if (parsed.outputState && !parsed.fixtureState) throw new TypeError('--output-state requires --fixture-state');
  return parsed;
}

function safeFailure(): string {
  return JSON.stringify({status: 'failed', error: 'enrichment_failed'});
}

export type EnrichCliResult = {exitCode: number; stdout: string};

/** CLI boundary: fixture state is in memory unless an explicit output path is supplied. */
export async function runEnrichCli(arguments_: string[]): Promise<EnrichCliResult> {
  try {
    const args = parseArguments(arguments_);
    let report: EnrichmentReport;
    if (args.providerFixture && args.fixtureState) {
      const records = parseSemrushPayload(JSON.parse(readFileSync(args.providerFixture, 'utf8'))).records;
      const repository = FixtureCompetitorRepository.fromSnapshot(args.fixtureState);
      report = await runEnrichment({
        repository,
        runDomainOverview: async () => records,
      });
      if (args.outputState) writeFileSync(args.outputState, `${JSON.stringify(repository.toSnapshot(), null, 2)}\n`, 'utf8');
    } else {
      if (!args.actorId) throw new TypeError('--actor-id is required outside fixture mode');
      const actorId = args.actorId;
      const env = getRefreshEnv();
      const repository = new AirtableCompetitorRepository(new AirtableClient({baseId: env.AIRTABLE_BASE_ID, apiToken: env.AIRTABLE_PAT}));
      const apify = new ApifyClient({token: env.APIFY_TOKEN});
      report = await runEnrichment({repository, runDomainOverview: (domains, options) => runDomainOverview(apify, domains, {...options, actorId})});
    }
    // A partial refresh retains successfully persisted companies and is safe to
    // retry. Only a fully failed run gets a non-zero Railway exit status.
    return {exitCode: report.status === 'failed' ? 1 : 0, stdout: JSON.stringify(report)};
  } catch {
    return {exitCode: 1, stdout: safeFailure()};
  }
}

async function main(): Promise<void> {
  const result = await runEnrichCli(process.argv.slice(2));
  process.stdout.write(`${result.stdout}\n`);
  process.exitCode = result.exitCode;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) void main();
