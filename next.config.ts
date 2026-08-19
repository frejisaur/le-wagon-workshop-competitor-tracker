import type {NextConfig} from 'next';
import {resolve} from 'node:path';

const fixtureConfig: NextConfig = {
  webpack(config, {dev, webpack}) {
    if (!dev) return config;
    const fixtureService = resolve(process.cwd(), 'tests/e2e/fixture-dashboard-service.ts');
    config.resolve.alias['@/lib/api/dashboard-service'] = fixtureService;
    config.resolve.alias[resolve(process.cwd(), 'lib/api/dashboard-service.ts')] = fixtureService;
    config.plugins.push(new webpack.NormalModuleReplacementPlugin(/lib[\\/]api[\\/]dashboard-service$/, fixtureService));
    return config;
  },
};

const nextConfig: NextConfig = process.env.E2E_FIXTURES === '1' ? fixtureConfig : {};

export default nextConfig;
