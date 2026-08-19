import {existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

export type WorkshopPhase = 'data' | 'ui' | 'deploy' | 'all';
export type PreflightCheck = {category: 'tool' | 'file' | 'variable' | 'connection'; name: string; status: 'present' | 'missing' | 'ready' | 'unavailable'};
export type WorkshopPreflightReport = {phase: WorkshopPhase; ready: boolean; checks: PreflightCheck[]};

type CommandProbe = (name: string, args: string[]) => Promise<{ok: boolean}>;
type Options = {phase: WorkshopPhase; environment?: Record<string, string | undefined>; fileExists?: (path: string) => boolean; probeCommand?: CommandProbe};

const files = {
  data: ['tests/fixtures/providers/apollo-sample.csv', 'tests/fixtures/providers/semrush-sample.json'],
  ui: ['workshop/design/selected-all-companies.html', 'workshop/design/company-detail-reference.html', 'workshop/design/dashboard-fixture.json'],
  deploy: ['Dockerfile', 'railway.toml', 'railway.cron.toml'],
} as const;
const variables = {
  data: ['AIRTABLE_PAT', 'AIRTABLE_BASE_ID', 'APIFY_TOKEN', 'APIFY_ACTOR_ID'],
  ui: [],
  deploy: ['AIRTABLE_PAT', 'AIRTABLE_BASE_ID', 'APIFY_TOKEN', 'APIFY_ACTOR_ID', 'APP_BASE_URL', 'CACHE_INVALIDATION_SECRET'],
} as const;

function phases(phase: WorkshopPhase): Array<'data' | 'ui' | 'deploy'> { return phase === 'all' ? ['data', 'ui', 'deploy'] : [phase]; }
function unique(values: readonly string[]): string[] { return [...new Set(values)]; }

async function defaultProbe(name: string, args: string[]): Promise<{ok: boolean}> {
  const result = spawnSync(name, args, {stdio: 'ignore'});
  return {ok: result.status === 0};
}

export async function runWorkshopPreflight(options: Options): Promise<WorkshopPreflightReport> {
  const selected = phases(options.phase);
  const environment = options.environment ?? process.env;
  const fileExists = options.fileExists ?? existsSync;
  const probe = options.probeCommand ?? defaultProbe;
  const checks: PreflightCheck[] = [];
  const tools = unique(selected.flatMap((phase) => phase === 'deploy' ? ['node', 'npm', 'claude', 'railway'] : ['node', 'npm', 'claude']));
  for (const tool of tools) checks.push({category: 'tool', name: tool, status: (await probe(tool, ['--version'])).ok ? 'ready' : 'unavailable'});
  for (const path of unique(selected.flatMap((phase) => [...files[phase]]))) checks.push({category: 'file', name: path, status: fileExists(path) ? 'present' : 'missing'});
  for (const name of unique(selected.flatMap((phase) => [...variables[phase]]))) checks.push({category: 'variable', name, status: environment[name]?.trim() ? 'present' : 'missing'});
  checks.push({category: 'connection', name: 'claude-mcp', status: (await probe('claude', ['mcp', 'list'])).ok ? 'ready' : 'unavailable'});
  if (selected.includes('deploy')) checks.push({category: 'connection', name: 'railway-project', status: (await probe('railway', ['status', '--json'])).ok ? 'ready' : 'unavailable'});
  return {phase: options.phase, ready: checks.every((check) => check.status === 'present' || check.status === 'ready'), checks};
}
