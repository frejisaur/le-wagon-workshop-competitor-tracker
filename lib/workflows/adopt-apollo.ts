import {createHash} from 'node:crypto';
import {companyIdOf, parseCompanyRecord, toCompanyFields} from '@/lib/airtable/company-row';
import type {AirtableRecord, AirtableWriteRecord} from '@/lib/airtable/types';
import {parseApolloCsv} from '@/lib/schemas/apollo';
import {joinRoster} from '@/lib/transforms/join-roster';
import {normalizeDomain} from '@/lib/transforms/normalize';

/** Match legacy records to the saved source before planning any mutation. */
export function planApolloAdoption(source: string, records: AirtableRecord[]) {
  const apollo = parseApolloCsv(source);
  const roster = joinRoster(apollo, []);
  if (roster.rejections.some(issue => issue.code !== 'missing_apollo_website')) throw new Error('source_conflict');
  const byAccount = new Map(apollo.map(row => [row['Apollo Account Id'], row]));
  if (byAccount.size !== apollo.length || byAccount.has('')) throw new Error('ambiguous_apollo_accounts');
  const matched = new Set<string>();
  const updates: AirtableWriteRecord[] = [];
  const missingWebsiteIds: string[] = [];
  for (const record of records) {
    const fields = record.fields;
    const account = String(fields['Apollo Account ID'] ?? fields['Observed • Apollo Account ID'] ?? '');
    const row = byAccount.get(account);
    if (!row || matched.has(account)) throw new Error('unmatched_or_duplicate_stored_account');
    matched.add(account);
    const domain = normalizeDomain(row.Website);
    const existingDomain = String(fields['Canonical Domain'] ?? fields['Identity • Canonical Domain'] ?? '');
    const currentId = companyIdOf(parseCompanyRecord(record));
    if (!row.Website.trim()) {
      if (existingDomain.trim() || fields['Identity • Canonical Domain'] || fields['Observed • Apollo Website'] || fields['Website'] || currentId || fields['Match Status'] !== 'missing_apollo_website') throw new Error('website_conflict');
      missingWebsiteIds.push(record.id);
      continue;
    }
    if (!domain || domain !== normalizeDomain(existingDomain)) throw new Error('domain_conflict');
    if (currentId) {
      if (fields['Identity • Canonical Domain'] !== domain || fields['Observed • Apollo Account ID'] !== account) throw new Error('stored_identity_conflict');
      continue;
    }
    const companyId = 'company-' + createHash('sha256').update(record.id).digest('hex').slice(0,32);
    const mapped = toCompanyFields({companyId, identity: {canonicalDomain: domain, apolloAccountId: account, apolloRecordId: row['Apollo Record Id']}, qualityIssues: []});
    updates.push({id: record.id, fields: Object.fromEntries(Object.entries(mapped).filter(([key]) => key.startsWith('Identity • ') || key === 'Observed • Apollo Account ID' || key === 'Observed • Apollo Record ID'))});
  }
  if (roster.accepted.some(company => !matched.has(company.identity.apolloAccountId))) throw new Error('stored_roster_incomplete');
  return {updates, missingWebsiteIds};
}
