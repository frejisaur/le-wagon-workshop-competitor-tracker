import {describe, expect, it} from 'vitest';
import {getInsightEnv, getRefreshEnv, getWebEnv} from '@/lib/config/server-env';

const airtableEnv = {
  AIRTABLE_PAT: 'airtable-pat',
  AIRTABLE_BASE_ID: 'app-test',
  AIRTABLE_COMPANIES_TABLE: 'Companies',
  AIRTABLE_KEYWORDS_TABLE: 'Keywords',
  AIRTABLE_PAID_ADS_TABLE: 'Paid Ads',
  AIRTABLE_GTM_INSIGHTS_TABLE: 'GTM Insights',
  AIRTABLE_INSIGHT_REVIEWS_TABLE: 'Insight Reviews',
  AIRTABLE_SYSTEM_TABLE: 'System',
};

describe('server environment scopes', () => {
  it('rejects missing refresh credentials without printing their values', () => {
    expect(() => getRefreshEnv({})).toThrow(/AIRTABLE_PAT, AIRTABLE_BASE_ID, APIFY_TOKEN/);
  });

  it('does not expose refresh or model values to the web serving process', () => {
    const env = getWebEnv(airtableEnv);
    expect(env.AIRTABLE_BASE_ID).toBe('app-test');
    expect(env).not.toHaveProperty('APIFY_TOKEN');
    expect(env).not.toHaveProperty('CACHE_INVALIDATION_SECRET');
    expect(env).not.toHaveProperty('APP_BASE_URL');
    expect(env).not.toHaveProperty('OPENAI_API_KEY');
  });

  it('does not require or expose refresh or model values to insight commands', () => {
    const env = getInsightEnv(airtableEnv);
    expect(env.AIRTABLE_BASE_ID).toBe('app-test');
    expect(env).not.toHaveProperty('APIFY_TOKEN');
    expect(env).not.toHaveProperty('CACHE_INVALIDATION_SECRET');
    expect(env).not.toHaveProperty('APP_BASE_URL');
    expect(env).not.toHaveProperty('OPENAI_API_KEY');
  });

  it('does not print supplied secret values in validation errors', () => {
    let message = '';
    try {
      getRefreshEnv({
        ...airtableEnv,
        APIFY_TOKEN: 'sentinel-apify-token',
        CACHE_INVALIDATION_SECRET: 'sentinel-cache-secret',
        AIRTABLE_SYSTEM_TABLE: '',
      });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toContain('AIRTABLE_SYSTEM_TABLE');
    expect(message).not.toContain('sentinel-apify-token');
    expect(message).not.toContain('sentinel-cache-secret');
  });
});
