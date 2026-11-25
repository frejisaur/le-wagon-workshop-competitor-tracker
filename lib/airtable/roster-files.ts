import {z} from 'zod';
import {AirtableClient} from './client';
import type {AirtableRecord} from './types';

export const ROSTER_FILE = 'Refresh • Apollo CSV';
export const EXPORT_FILE = 'Refresh • Enriched CSV';
type FileField = typeof ROSTER_FILE | typeof EXPORT_FILE;
const attachments = z.array(z.object({id: z.string(), filename: z.string(), url: z.string().url()}));
const maxBytes = 5_000_000;

function files(record: AirtableRecord, field: FileField) {
  return attachments.parse(record.fields[field] ?? []);
}

export async function readAttachment(url: string): Promise<Buffer> {
  const target = new URL(url);
  if (target.protocol !== 'https:' || !target.hostname.endsWith('.airtableusercontent.com') || target.username || target.password) throw new Error('invalid_attachment_origin');
  const response = await fetch(target, {signal: AbortSignal.timeout(30_000), redirect: 'error'});
  if (!response.ok || Number(response.headers.get('content-length')) > maxBytes) throw new Error('attachment_read_failed');
  const data = Buffer.from(await response.arrayBuffer());
  if (data.length > maxBytes) throw new Error('attachment_too_large');
  return data;
}

export async function readSavedRoster(system: AirtableRecord) {
  const source = files(system, ROSTER_FILE);
  if (source.length !== 1) throw new Error('expected_one_saved_apollo_csv');
  return (await readAttachment(source[0].url)).toString('utf8');
}

export async function saveCsv(client: AirtableClient, system: AirtableRecord, field: FileField, filename: string, data: Buffer) {
  if (data.length > maxBytes) throw new Error('csv_too_large');
  const existing = files(system, field);
  // A retry after upload or before trimming can reuse the already uploaded bytes.
  const latest = existing.at(-1);
  let keep = latest?.id;
  if (!latest || latest.filename !== filename || !(await readAttachment(latest.url)).equals(data)) {
    await client.uploadCsv(system.id, field, filename, data);
    const added = files(await rosterSystem(client), field).filter(file => !existing.some(prior => prior.id === file.id));
    if (added.length !== 1) throw new Error('csv_upload_unconfirmed');
    keep = added[0].id;
  }
  if (existing.some(file => file.id !== keep)) {
    await client.update('System', [{id: system.id, fields: {[field]: [{id: keep!}]}}]);
  }
}

export async function rosterSystem(client: AirtableClient, create = false) {
  const records = await client.list('System', {filterByFormula: "{Identity • System ID}='system'"});
  if (!records.length && create) return (await client.create('System', [{fields: {'Identity • System ID': 'system'}}]))[0];
  if (records.length !== 1) throw new Error('expected_one_system_row');
  return records[0];
}
