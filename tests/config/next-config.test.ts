import {afterEach, describe, expect, it, vi} from 'vitest';
import type {NextConfig} from 'next';

afterEach(() => vi.unstubAllEnvs());

async function fixtureEnabledConfig(): Promise<NextConfig> {
  vi.stubEnv('E2E_FIXTURES', '1');
  vi.resetModules();
  return (await import('../../next.config')).default;
}

function applyWebpack(config: NextConfig, dev: boolean) {
  const webpackConfig = {resolve: {alias: {} as Record<string, string>}, plugins: [] as unknown[]};
  class ReplacementPlugin { constructor(..._args: unknown[]) {} }
  config.webpack?.(webpackConfig as never, {dev, webpack: {NormalModuleReplacementPlugin: ReplacementPlugin}} as never);
  return webpackConfig;
}

describe('fixture-only Next configuration', () => {
  it('cannot alias the dashboard service into tests during a production build', async () => {
    const configured = applyWebpack(await fixtureEnabledConfig(), false);
    expect(Object.values(configured.resolve.alias).some((value) => value.includes('/tests/'))).toBe(false);
    expect(configured.plugins).toHaveLength(0);
  });

  it('aliases the sanitized dashboard service only for explicit E2E development', async () => {
    const configured = applyWebpack(await fixtureEnabledConfig(), true);
    expect(Object.values(configured.resolve.alias).some((value) => value.includes('/tests/e2e/fixture-dashboard-service.ts'))).toBe(true);
    expect(configured.plugins).toHaveLength(1);
  });
});
