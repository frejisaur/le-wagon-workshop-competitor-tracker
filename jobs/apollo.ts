import {realpathSync, existsSync, readFileSync, writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {AirtableClient} from '@/lib/airtable/client';
import {AirtableCompetitorRepository} from '@/lib/airtable/repository';
import {FixtureCompetitorRepository} from '@/lib/airtable/fixture-repository';
import {EXPORT_FILE, ROSTER_FILE, readSavedRoster, rosterSystem, saveCsv} from '@/lib/airtable/roster-files';
import {getWebEnv} from '@/lib/config/server-env';
import {actorInput} from '@/lib/apify/run-domain-overview';
import {planApolloAdoption} from '@/lib/workflows/adopt-apollo';
import {verifyDashboard} from '@/lib/workflows/verify-dashboard';
import {exportApolloCsv} from '@/lib/workflows/apollo-export';
import {joinRoster} from '@/lib/transforms/join-roster';
import {parseApolloCsv} from '@/lib/schemas/apollo';
import {parseRunIds} from '@/lib/apify/completed-runs';

export async function runApollo([command, source, destination, state]: string[]) {
  if (command === 'prepare') {
    if (source) {
      const roster = joinRoster(parseApolloCsv(readFileSync(source, 'utf8')), []);
      return actorInput(roster.accepted.map(row => row.canonicalDomain));
    }
    const response = await fetch(new URL('/api/dashboard', process.env.APP_BASE_URL), {signal: AbortSignal.timeout(30_000)});
    if (!response.ok) throw new Error('dashboard_read_failed');
    const dashboard = await response.json();
    if (['loading', 'empty'].includes(dashboard.status)) throw new Error('roster_unavailable');
    return actorInput(dashboard.companies.map((company: {domain: string}) => company.domain));
  }

  if (command === 'export' && source && destination && existsSync(destination)
    && [source, state].some(path => path && realpathSync(path) === realpathSync(destination))) throw new Error('export_destination_is_input');
  if (command === 'export' && source && destination && state) {
    const snapshot = await FixtureCompetitorRepository.fromSnapshot(state).getDashboardSnapshot();
    const {csv, ...summary} = exportApolloCsv(readFileSync(source, 'utf8'), snapshot);
    writeFileSync(destination, csv, {mode: 0o600});
    return summary;
  }

  const env = getWebEnv();
  const client = new AirtableClient({baseId: env.AIRTABLE_BASE_ID, apiToken: env.AIRTABLE_PAT});
  if (command === 'adopt-legacy' && (source === '--dry-run' || source === '--remove-missing-websites')) {
    const original = await readSavedRoster(await rosterSystem(client));
    const plan = planApolloAdoption(original, await client.list('Companies'));
    if (source === '--remove-missing-websites') {
      await client.update('Companies', plan.updates);
      for (const recordId of plan.missingWebsiteIds) await client.deleteRecord('Companies', recordId);
    }
    return {mode: source, adopted: plan.updates.length, missingWebsites: plan.missingWebsiteIds.length};
  }
  if (command === 'save-roster' && source) {
    const data = readFileSync(source);
    const roster = joinRoster(parseApolloCsv(data.toString('utf8')), []);
    if (!roster.accepted.length) throw new Error('empty_roster');
    await saveCsv(client, await rosterSystem(client, true), ROSTER_FILE, 'apollo-accounts-list.csv', data);
    return {accepted: roster.accepted.length, rejected: roster.rejections.length};
  }
  if (command !== 'export') throw new Error('unknown_command');
  const snapshot = await new AirtableCompetitorRepository(client).getDashboardSnapshot();
  if (source && destination) {
    const {csv, ...summary} = exportApolloCsv(readFileSync(source, 'utf8'), snapshot);
    writeFileSync(destination, csv, {mode: 0o600});
    return summary;
  }
  const system = await rosterSystem(client);
  const runId = 'apify-' + parseRunIds(source ?? '').join(',');
  if (system.fields['Refresh • Run ID'] !== runId || system.fields['Workflow • Status'] !== 'succeeded') throw new Error('refresh_not_current');
  const {csv, rows, matched, accepted} = exportApolloCsv(await readSavedRoster(system), snapshot);
  if (!matched || matched !== accepted || matched !== system.fields['Workflow • Processed Companies']) throw new Error('export_coverage_mismatch');
  const freshness = await verifyDashboard(process.env.APP_BASE_URL ?? '', snapshot);
  await saveCsv(client, system, EXPORT_FILE, 'apollo-accounts-enriched.csv', Buffer.from(csv));
  return {rows, matched, runId, freshness};
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  runApollo(process.argv.slice(2)).then(result => console.log(JSON.stringify(result))).catch(() => {
    console.error('Apollo operation failed. Check roster, refresh status, file paths and base access.');
    process.exitCode = 1;
  });
}
