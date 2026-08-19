import type {CompanyComparison, CompanyResponse, LandscapeResponse} from '@/lib/domain/dashboard';
import {companyStates} from '@/tests/fixtures/api/company-states';
import {dashboardStates} from '@/tests/fixtures/api/dashboard-states';

const companies = new Map<string, CompanyResponse>([
  ['alpha', companyStates.publishedPlusReview],
  ['bravo', companyStates.noPaid],
  ['charlie', companyStates.fingerprintMismatch],
]);

function comparisons(companyId: string): CompanyComparison[] {
  return [...companies.values()].filter((company) => company.companyId !== companyId).map((company) => ({companyId: company.companyId, identity: company.identity, trend: company.trend}));
}

export async function getLandscapeResponse(): Promise<LandscapeResponse> { return dashboardStates.current; }
export async function getCompanyResponse(companyId: string): Promise<CompanyResponse | undefined> { return companies.get(companyId); }
export async function getCompanyWorkspaceResponse(companyId: string): Promise<{company: CompanyResponse; comparisons: CompanyComparison[]} | undefined> {
  const company = companies.get(companyId);
  return company ? {company, comparisons: comparisons(companyId)} : undefined;
}
export function getDashboardCache(): {invalidate: () => void} { return {invalidate() { /* deterministic E2E fixture has no cache */ }}; }
