import {describe, expect, it} from 'vitest';
import {DEFAULT_APIFY_ACTOR_ID} from '@/lib/apify/constants';
import {getInsightEnv, getRefreshDispatchEnv, getRefreshEnv, getWebEnv} from '@/lib/config/server-env';

const airtableEnv = {
  AIRTABLE_PAT: 'airtable-pat',
  AIRTABLE_BASE_ID: 'app-test',
};

describe('server environment scopes', () => {
  it('rejects missing refresh credentials without printing their values', () => {
    expect(() => getRefreshEnv({})).toThrow(/APIFY_TOKEN.*APIFY_ACTOR_ID/);
  });

  it('requires the reviewed server-only scheduled actor ID and returns it only to refresh code', () => {
    expect(() => getRefreshEnv({...airtableEnv, APIFY_TOKEN: 'token', APP_BASE_URL: 'https://app.example', CACHE_INVALIDATION_SECRET: 'cache-secret'})).toThrow(/APIFY_ACTOR_ID/);
    expect(() => getRefreshEnv({...airtableEnv, APIFY_TOKEN: 'token', APIFY_ACTOR_ID: 'owner/actor', APP_BASE_URL: 'https://app.example', CACHE_INVALIDATION_SECRET: 'cache-secret'})).toThrow(/APIFY_ACTOR_ID/);
    expect(getRefreshEnv({...airtableEnv, APIFY_TOKEN: 'token', APIFY_ACTOR_ID: DEFAULT_APIFY_ACTOR_ID, APP_BASE_URL: 'https://app.example', CACHE_INVALIDATION_SECRET: 'cache-secret'}).APIFY_ACTOR_ID).toBe(DEFAULT_APIFY_ACTOR_ID);
  });

  it('does not expose refresh or model values to the web serving process', () => {
    const env = getWebEnv(airtableEnv);
    expect(env.AIRTABLE_BASE_ID).toBe('app-test');
    expect(env).not.toHaveProperty('APIFY_TOKEN');
    expect(env).not.toHaveProperty('APIFY_ACTOR_ID');
    expect(env).not.toHaveProperty('CACHE_INVALIDATION_SECRET');
    expect(env).not.toHaveProperty('APP_BASE_URL');
    expect(env).not.toHaveProperty('OPENAI_API_KEY');
  });

  it('does not require or expose refresh or model values to insight commands', () => {
    const env = getInsightEnv(airtableEnv);
    expect(env.AIRTABLE_BASE_ID).toBe('app-test');
    expect(env).not.toHaveProperty('APIFY_TOKEN');
    expect(env).not.toHaveProperty('APIFY_ACTOR_ID');
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
        AIRTABLE_BASE_ID: '',
      });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toContain('AIRTABLE_BASE_ID');
    expect(message).not.toContain('sentinel-apify-token');
    expect(message).not.toContain('sentinel-cache-secret');
  });

  it('gives a refresh dispatcher only its GitHub token, never data or provider credentials', () => {
    const env = getRefreshDispatchEnv({...airtableEnv, APIFY_TOKEN: 'token', GITHUB_DISPATCH_TOKEN: 'gh-token', GITHUB_REPOSITORY: 'owner/repo'});
    expect(env).toEqual({GITHUB_DISPATCH_TOKEN: 'gh-token', GITHUB_REPOSITORY: 'owner/repo'});
    expect(() => getRefreshDispatchEnv({GITHUB_DISPATCH_TOKEN: 'sentinel-gh-token', GITHUB_REPOSITORY: 'not a repo'})).toThrow(/^(?!.*sentinel-gh-token).*GITHUB_REPOSITORY/);
  });
});
