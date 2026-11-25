import {pathToFileURL} from 'node:url';
import {getWebEnv} from '@/lib/config/server-env';
import {ensureAirtableSchema, type EnsureAirtableSchemaResult} from '@/lib/airtable/schema';

type SchemaCliDependencies = {
  env?: NodeJS.Dict<string>;
  ensure?: (options: {baseId: string; apiToken: string}) => Promise<EnsureAirtableSchemaResult>;
};

export type AirtableSchemaCliResult = {exitCode: number; stdout: string};

export async function runAirtableSchemaCli(dependencies: SchemaCliDependencies = {}): Promise<AirtableSchemaCliResult> {
  try {
    const env = getWebEnv(dependencies.env ?? process.env);
    const result = await (dependencies.ensure ?? ensureAirtableSchema)({baseId: env.AIRTABLE_BASE_ID, apiToken: env.AIRTABLE_PAT});
    const createdFields = Object.values(result.createdFields).reduce((sum, count) => sum + count, 0);
    return {exitCode: 0, stdout: JSON.stringify({status: 'succeeded', createdTables: result.createdTables.length, createdFields})};
  } catch {
    return {exitCode: 1, stdout: JSON.stringify({status: 'failed', error: 'airtable_schema_setup_failed'})};
  }
}

async function main(): Promise<void> {
  const result = await runAirtableSchemaCli();
  process.stdout.write(`${result.stdout}\n`);
  process.exitCode = result.exitCode;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) void main();
