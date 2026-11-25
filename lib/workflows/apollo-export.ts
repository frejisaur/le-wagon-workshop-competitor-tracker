import Papa from 'papaparse';
import type {DashboardSnapshot} from '@/lib/airtable/types';
import {parseApolloCsv} from '@/lib/schemas/apollo';
import {joinRoster} from '@/lib/transforms/join-roster';
import {normalizeDomain} from '@/lib/transforms/normalize';

const observed = ['Database', 'At', 'Authority Score', 'Organic Traffic', 'Organic Keywords', 'Paid Traffic', 'Referring Domains'];
const headers = ['Match Status', 'Canonical Domain', 'Semrush Database', 'Observation Time', ...observed.slice(2)];

export function exportApolloCsv(source: string, snapshot: DashboardSnapshot) {
  const rows = parseApolloCsv(source);
  const join = joinRoster(rows, []);
  const reasons = new Map(join.rejections.map(issue => [issue.apolloIndex, issue.code]));
  const originals = Papa.parse<string[]>(source, {skipEmptyLines: 'greedy'});
  const [columns, ...cells] = originals.data;
  if (originals.errors.length || !columns || columns.some(column => headers.includes(column)) || cells.length !== rows.length) {
    throw new Error('invalid_export_columns');
  }
  const byDomain = new Map<string, DashboardSnapshot['companies']>();
  for (const company of snapshot.companies) {
    const domain = normalizeDomain(String(company.fields['Identity • Canonical Domain'] ?? ''));
    if (domain) byDomain.set(domain, [...(byDomain.get(domain) ?? []), company]);
  }
  let matched = 0;
  const result = cells.map((original, index) => {
    const domain = normalizeDomain(rows[index].Website);
    const companies = byDomain.get(domain ?? '') ?? [];
    const fields = companies[0]?.fields;
    const account = rows[index]['Apollo Account Id'];
    const record = rows[index]['Apollo Record Id'];
    const conflict = fields && ((account && fields['Observed • Apollo Account ID'] && fields['Observed • Apollo Account ID'] !== account)
      || (record && fields['Observed • Apollo Record ID'] && fields['Observed • Apollo Record ID'] !== record));
    const status = reasons.get(index) ?? (companies.length > 1 || conflict ? 'stored_identity_conflict'
      : !fields ? 'company_missing' : !fields['Observed • At'] ? 'observation_missing' : 'matched');
    if (status === 'matched') matched++;
    const metrics = observed.map(name => status === 'matched' ? fields['Observed • ' + name] ?? '' : '');
    return [...original, status, domain ?? '', ...metrics];
  });
  return {csv: Papa.unparse([[...columns, ...headers], ...result]), rows: rows.length, matched, accepted: join.accepted.length};
}
