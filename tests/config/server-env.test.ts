import {describe, expect, it} from 'vitest';
import {getRefreshEnv, getWebEnv} from '@/lib/config/server-env';

describe('server environment scopes', () => {
  it('rejects missing refresh credentials without printing their values', () => {
    expect(() => getRefreshEnv({})).toThrow(/AIRTABLE_PAT, AIRTABLE_BASE_ID, APIFY_TOKEN/);
  });

  it('does not require Apify for the web serving process', () => {
    const env = getWebEnv({
      AIRTABLE_PAT: 'hidden', AIRTABLE_BASE_ID: 'app-test', APIFY_TOKEN: 'hidden',
      CACHE_INVALIDATION_SECRET: 'hidden', APP_BASE_URL: 'http://127.0.0.1:3000',
      AIRTABLE_COMPANIES_TABLE: 'Companies', AIRTABLE_KEYWORDS_TABLE: 'Keywords',
      AIRTABLE_PAID_ADS_TABLE: 'Paid Ads', AIRTABLE_GTM_INSIGHTS_TABLE: 'GTM Insights',
      AIRTABLE_INSIGHT_REVIEWS_TABLE: 'Insight Reviews', AIRTABLE_SYSTEM_TABLE: 'System',
    });
    expect(env.AIRTABLE_BASE_ID).toBe('app-test');
  });
});
