export const companyTabs = ['overview', 'ai', 'search', 'authority', 'paid', 'battlecard', 'evidence'] as const;
export type CompanyTab = (typeof companyTabs)[number];

export function parseCompanyTab(search: string, paidAvailable: boolean): CompanyTab {
  const tab = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search).get('tab');
  return companyTabs.includes(tab as CompanyTab) && (tab !== 'paid' || paidAvailable) ? tab as CompanyTab : 'overview';
}

export function serializeCompanyTab(tab: CompanyTab, paidAvailable: boolean): string {
  return tab !== 'overview' && (tab !== 'paid' || paidAvailable) ? `tab=${tab}` : '';
}
