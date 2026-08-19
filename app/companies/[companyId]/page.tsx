import {notFound} from 'next/navigation';
import {CompanyWorkspace} from '@/components/company/CompanyWorkspace';
import {parseCompanyTab} from '@/components/company/company-tab';
import {AppShell} from '@/components/shared/AppShell';
import {getCompanyWorkspaceResponse} from '@/lib/api/dashboard-service';

const COMPANY_ID = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/;

function queryString(params: Record<string, string | string[] | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string') search.set(key, value);
    else if (Array.isArray(value) && typeof value[0] === 'string') search.set(key, value[0]);
  }
  return search.toString();
}

/** Server component: it loads the dashboard service directly and never self-fetches the API route. */
export default async function CompanyPage({params, searchParams}: {params: Promise<{companyId: string}>; searchParams: Promise<Record<string, string | string[] | undefined>>}) {
  const [{companyId}, rawSearch] = await Promise.all([params, searchParams]);
  if (!COMPANY_ID.test(companyId)) notFound();
  const workspace = await getCompanyWorkspaceResponse(companyId);
  if (!workspace) notFound();
  const {company, comparisons} = workspace;
  const search = queryString(rawSearch);
  const paidAvailable = Boolean(company.paid && (company.paid.ads.length > 0 || (typeof company.paid.traffic.value === 'number' && company.paid.traffic.value > 0) || (typeof company.paid.keywords.value === 'number' && company.paid.keywords.value > 0)));
  const tab = parseCompanyTab(search, paidAvailable);
  return <AppShell status={company.status} freshness={company.freshness} breadcrumb={company.identity.displayName ?? company.identity.domain}><CompanyWorkspace company={company} comparison={comparisons} initialTab={tab} initialSearch={search ? `?${search}` : ''} /></AppShell>;
}
