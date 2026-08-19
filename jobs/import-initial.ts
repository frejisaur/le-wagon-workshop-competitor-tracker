import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {AirtableCompetitorRepository} from '@/lib/airtable/repository';
import {FixtureCompetitorRepository} from '@/lib/airtable/fixture-repository';
import {AirtableClient} from '@/lib/airtable/client';
import {getWebEnv} from '@/lib/config/server-env';
import {parseApolloCsv} from '@/lib/schemas/apollo';
import {parseSemrushPayload} from '@/lib/schemas/semrush';
import {runInitialImport} from '@/lib/workflows/import-initial';

type CliArguments = {
  apollo: string;
  semrush?: string;
  apolloOnly: boolean;
  dryRun: boolean;
  fixtureState?: string;
};

function parseArguments(arguments_: string[]): CliArguments {
  let apollo: string | undefined;
  let semrush: string | undefined;
  let fixtureState: string | undefined;
  let apolloOnly = false;
  let dryRun = false;
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === '--dry-run') {
      dryRun = true;
      continue;
    }
    if (argument === '--apollo-only') {
      apolloOnly = true;
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
  if (!apollo) throw new TypeError('--apollo is required');
  if (Boolean(semrush) === apolloOnly) {
    throw new TypeError('exactly one of --semrush or --apollo-only is required');
  }
  return {apollo, semrush, apolloOnly, dryRun, fixtureState};
}

function safeFailureSummary(): string {
  return JSON.stringify({status: 'failed', error: 'initial_import_failed'});
}

type CliDependencies = {
  readFile?: (path: string, encoding: BufferEncoding) => string;
  runInitialImport?: typeof runInitialImport;
};

export type InitialImportCliResult = {exitCode: number; stdout: string};

/** Injectable CLI boundary: returns exactly one sanitized JSON line and never logs raw rows. */
export async function runInitialImportCli(arguments_: string[], dependencies: CliDependencies = {}): Promise<InitialImportCliResult> {
  try {
    const parsedArguments = parseArguments(arguments_);
    const readFile = dependencies.readFile ?? readFileSync;
    const apolloRows = parseApolloCsv(readFile(parsedArguments.apollo, 'utf8'));
    const semrushRecords = parsedArguments.apolloOnly
      ? []
      : parseSemrushPayload(JSON.parse(readFile(parsedArguments.semrush!, 'utf8'))).records;
    const repository = parsedArguments.dryRun
      ? undefined
      : parsedArguments.fixtureState
        ? FixtureCompetitorRepository.fromSnapshot(parsedArguments.fixtureState)
        : (() => {
          const env = getWebEnv();
          return new AirtableCompetitorRepository(new AirtableClient({baseId: env.AIRTABLE_BASE_ID, apiToken: env.AIRTABLE_PAT}));
        })();
    const report = await (dependencies.runInitialImport ?? runInitialImport)({apolloRows, semrushRecords, repository, dryRun: parsedArguments.dryRun});
    // Partial imports are successful recoverable reports. A budget rejection or
    // a run that could not persist any accepted company is unrecovered.
    const unrecovered = !report.recordBudget.withinFreeLimit
      || (report.accepted === 0 && report.rejected > 0)
      || (!parsedArguments.dryRun && report.accepted > 0 && report.succeeded === 0);
    return {exitCode: unrecovered ? 1 : 0, stdout: JSON.stringify(report)};
  } catch {
    return {exitCode: 1, stdout: safeFailureSummary()};
  }
}

async function main(): Promise<void> {
  const result = await runInitialImportCli(process.argv.slice(2));
  process.stdout.write(`${result.stdout}\n`);
  process.exitCode = result.exitCode;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) void main();
