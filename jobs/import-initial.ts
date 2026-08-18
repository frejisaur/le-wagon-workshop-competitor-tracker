import {readFileSync} from 'node:fs';
import {AirtableCompetitorRepository} from '@/lib/airtable/repository';
import {FixtureCompetitorRepository} from '@/lib/airtable/fixture-repository';
import {AirtableClient} from '@/lib/airtable/client';
import {getWebEnv} from '@/lib/config/server-env';
import {parseApolloCsv} from '@/lib/schemas/apollo';
import {parseSemrushPayload} from '@/lib/schemas/semrush';
import {runInitialImport} from '@/lib/workflows/import-initial';

type CliArguments = {apollo: string; semrush: string; dryRun: boolean; fixtureState?: string};

function parseArguments(arguments_: string[]): CliArguments {
  let apollo: string | undefined;
  let semrush: string | undefined;
  let fixtureState: string | undefined;
  let dryRun = false;
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === '--dry-run') {
      dryRun = true;
      continue;
    }
    if (argument === '--apollo' || argument === '--semrush' || argument === '--fixture-state') {
      const value = arguments_[index + 1];
      if (!value || value.startsWith('--')) throw new TypeError(`${argument} requires a file path`);
      if (argument === '--apollo') apollo = value;
      if (argument === '--semrush') semrush = value;
      if (argument === '--fixture-state') fixtureState = value;
      index += 1;
      continue;
    }
    throw new TypeError(`unsupported argument: ${argument}`);
  }
  if (!apollo || !semrush) throw new TypeError('--apollo and --semrush are required');
  return {apollo, semrush, dryRun, fixtureState};
}

function safeFailureSummary(): string {
  return JSON.stringify({status: 'failed', error: 'initial_import_failed'});
}

async function main(): Promise<number> {
  try {
    const arguments_ = parseArguments(process.argv.slice(2));
    const apolloRows = parseApolloCsv(readFileSync(arguments_.apollo, 'utf8'));
    const semrushRecords = parseSemrushPayload(JSON.parse(readFileSync(arguments_.semrush, 'utf8'))).records;
    const repository = arguments_.dryRun
      ? undefined
      : arguments_.fixtureState
        ? FixtureCompetitorRepository.fromSnapshot(arguments_.fixtureState)
        : (() => {
          const env = getWebEnv();
          return new AirtableCompetitorRepository(new AirtableClient({baseId: env.AIRTABLE_BASE_ID, apiToken: env.AIRTABLE_PAT}));
        })();
    const report = await runInitialImport({apolloRows, semrushRecords, repository, dryRun: arguments_.dryRun});
    process.stdout.write(`${JSON.stringify(report)}\n`);
    // Partial imports are successful recoverable reports. A budget rejection or
    // a run that could not persist any accepted company is unrecovered.
    return !report.recordBudget.withinFreeLimit || (!arguments_.dryRun && report.accepted > 0 && report.succeeded === 0) ? 1 : 0;
  } catch {
    process.stdout.write(`${safeFailureSummary()}\n`);
    return 1;
  }
}

main().then((exitCode) => {
  process.exitCode = exitCode;
});
