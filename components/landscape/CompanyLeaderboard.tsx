'use client';

import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from '@carbon/react';
import {useEffect} from 'react';
import type {CompanySummary} from '@/lib/domain/dashboard';
import {Freshness} from '@/components/shared/Freshness';
import type {LandscapeSort} from './filter-state';

const integer = new Intl.NumberFormat('en-US', {maximumFractionDigits: 0});
const percent = new Intl.NumberFormat('en-US', {style: 'percent', maximumFractionDigits: 1});
const unavailable = (value: number | boolean | null, formatter: (value: number) => string = integer.format) => value === null ? 'Not available' : typeof value === 'boolean' ? value ? 'Active' : 'Inactive' : formatter(value);
type Column = {key: string; label: string; sort: Exclude<LandscapeSort, 'traffic-desc'> | 'traffic-desc'; value: (company: CompanySummary) => number | boolean | null; format?: (value: number) => string; className?: string};
const columns: readonly Column[] = [
  {key: 'authority', label: 'Authority', sort: 'authority-desc', value: (company) => typeof company.authorityScore.value === 'number' ? company.authorityScore.value : null},
  {key: 'traffic', label: 'Estimated organic traffic', sort: 'traffic-desc', value: (company) => typeof company.organicTraffic.value === 'number' ? company.organicTraffic.value : null},
  {key: 'movement', label: '30-day calculation', sort: 'movement-desc', value: (company) => typeof company.organicTraffic30DayMovement.value === 'number' ? company.organicTraffic30DayMovement.value : null, format: percent.format, className: 'company-leaderboard__tablet-hidden'},
  {key: 'nonBrand', label: 'Non-brand share', sort: 'nonBrand-desc', value: (company) => typeof company.nonBrandShare.value === 'number' ? company.nonBrandShare.value : null, format: percent.format, className: 'company-leaderboard__desktop-only'},
  {key: 'keywords', label: 'Keywords', sort: 'keywords-desc', value: (company) => typeof company.organicKeywords.value === 'number' ? company.organicKeywords.value : null, className: 'company-leaderboard__desktop-only'},
  {key: 'paid', label: 'Paid activity', sort: 'paid-desc', value: (company) => typeof company.paidActivity.value === 'boolean' ? company.paidActivity.value : null, className: 'company-leaderboard__desktop-only'},
  {key: 'ai', label: 'AI benchmark gap', sort: 'ai-desc', value: (company) => typeof company.aiBenchmarkGap.value === 'number' ? company.aiBenchmarkGap.value : null, format: percent.format, className: 'company-leaderboard__tablet-hidden'},
  {key: 'referring', label: 'Referring domains', sort: 'referring-desc', value: (company) => typeof company.referringDomains.value === 'number' ? company.referringDomains.value : null, className: 'company-leaderboard__desktop-only'},
];

function sortDirection(sort: LandscapeSort, key: string): 'ascending' | 'descending' | 'none' { return sort.startsWith(`${key}-`) ? sort.endsWith('-asc') ? 'ascending' : 'descending' : 'none'; }

export function CompanyLeaderboard({companies, selectedCompany, focusRequest, sort, onSort, onSelect}: {companies: readonly CompanySummary[]; selectedCompany?: string; focusRequest?: {companyId: string; token: number}; sort: LandscapeSort; onSort: (sort: LandscapeSort) => void; onSelect: (companyId: string) => void}) {
  useEffect(() => { if (focusRequest) document.getElementById(`leaderboard-row-${focusRequest.companyId}`)?.focus(); }, [focusRequest]);
  const headerSort = (column: Column) => { const current = sortDirection(sort, column.key); onSort(`${column.key}-${current === 'descending' ? 'asc' : 'desc'}` as LandscapeSort); };
  const mobileDetails = columns.filter((column) => column.className === 'company-leaderboard__desktop-only');
  return <section className="company-leaderboard" aria-labelledby="company-leaderboard-heading"><div className="landscape-panel-heading"><h2 id="company-leaderboard-heading">Company leaderboard</h2><p>Sortable, freshness-aware comparison</p></div><div className="company-leaderboard__scroll"><Table aria-label="Company leaderboard"><TableHead><TableRow><TableHeader>Company</TableHeader>{columns.map((column) => <TableHeader key={column.key} className={column.className} aria-sort={sortDirection(sort, column.key)}><button type="button" className="company-leaderboard__sort" onClick={() => headerSort(column)}>Sort by {column.label}</button></TableHeader>)}<TableHeader>Freshness</TableHeader></TableRow></TableHead><TableBody>{companies.map((company) => <TableRow id={`leaderboard-row-${company.companyId}`} key={company.companyId} data-company-row={company.companyId} aria-selected={selectedCompany === company.companyId} tabIndex={-1} onClick={() => onSelect(company.companyId)}><TableCell><a href={`/companies/${encodeURIComponent(company.companyId)}`}>{company.displayName ?? company.domain}</a><span className="company-leaderboard__domain">{company.domain}</span><details className="company-leaderboard__mobile-disclosure"><summary>Details</summary><dl>{mobileDetails.map((column) => <div key={column.key}><dt>{column.label}</dt><dd>{unavailable(column.value(company), column.format)}</dd></div>)}</dl></details></TableCell>{columns.map((column) => <TableCell key={column.key} className={column.className}>{unavailable(column.value(company), column.format)}</TableCell>)}<TableCell><Freshness freshness={company.freshness} /></TableCell></TableRow>)}</TableBody></Table></div></section>;
}
