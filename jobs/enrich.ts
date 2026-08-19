import {readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {AirtableClient} from '@/lib/airtable/client';
import {FixtureCompetitorRepository} from '@/lib/airtable/fixture-repository';
import {AirtableCompetitorRepository} from '@/lib/airtable/repository';
import {ApifyClient} from '@/lib/apify/client';
import {DEFAULT_APIFY_ACTOR_ID} from '@/lib/apify/constants';
import {createCacheInvalidationAdapter} from '@/lib/cache/invalidation-client';
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
const INTERNAL_REFRESH_TIMEOUT_MS = 14 * 60 * 1_000;

/** Explicit CLI actor selection overrides the validated server default. */
export function resolveLiveActorId(explicitActorId: string | undefined, env: Pick<ReturnType<typeof getRefreshEnv>, 'APIFY_ACTOR_ID'>): string {
  return explicitActorId ?? env.APIFY_ACTOR_ID ?? DEFAULT_APIFY_ACTOR_ID;
}

/** Refuse the only fixture-mode write that could overwrite its source state. */
export function assertDistinctFixturePaths(fixtureState: string, outputState: string): void {
  if (resolve(fixtureState) === resolve(outputState)) throw new TypeError('output-state must not resolve to fixture-state');
}

/** CLI boundary: fixture state is in memory unless an explicit output path is supplied. */
export async function runEnrichCli(arguments_: string[]): Promise<EnrichCliResult> {
  try {
    const args = parseArguments(arguments_);
    if (args.fixtureState && args.outputState) assertDistinctFixturePaths(args.fixtureState, args.outputState);
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
      const env = getRefreshEnv();
      const actorId = resolveLiveActorId(args.actorId, env);
      const repository = new AirtableCompetitorRepository(new AirtableClient({baseId: env.AIRTABLE_BASE_ID, apiToken: env.AIRTABLE_PAT}), {
        companies: env.AIRTABLE_COMPANIES_TABLE, keywords: env.AIRTABLE_KEYWORDS_TABLE, paidAds: env.AIRTABLE_PAID_ADS_TABLE,
        insights: env.AIRTABLE_GTM_INSIGHTS_TABLE, reviews: env.AIRTABLE_INSIGHT_REVIEWS_TABLE, system: env.AIRTABLE_SYSTEM_TABLE,
      });
      const apify = new ApifyClient({token: env.APIFY_TOKEN});
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(new Error('refresh_internal_timeout')), INTERNAL_REFRESH_TIMEOUT_MS);
      try {
        report = await runEnrichment({
          repository,
          runDomainOverview: (domains, options) => runDomainOverview(apify, domains, {...options, actorId}),
          // Live only: fixture mode remains self-contained and never needs a URL or secret.
          cache: createCacheInvalidationAdapter({baseUrl: env.APP_BASE_URL, secret: env.CACHE_INVALIDATION_SECRET}),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }
    }
    // Partial refreshes retain successful writes but must still make Railway
    // surface operator work. Only complete success exits zero.
    return {exitCode: report.status === 'succeeded' ? 0 : 1, stdout: JSON.stringify(report)};
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
