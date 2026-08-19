import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {describe, expect, it} from 'vitest';
import {parseApolloCsv} from '@/lib/schemas/apollo';
import {parseSemrushPayload, type SemrushDomainOverview} from '@/lib/schemas/semrush';
import {INITIAL_APIFY_OBSERVATION_BATCH, joinRoster} from '@/lib/transforms/join-roster';

const fixtureDirectory = resolve(process.cwd(), 'tests/fixtures/providers');
const apolloFixture = parseApolloCsv(readFileSync(resolve(fixtureDirectory, 'apollo-sample.csv'), 'utf8'));
const semrushFixture = parseSemrushPayload(JSON.parse(readFileSync(resolve(fixtureDirectory, 'semrush-sample.json'), 'utf8'))).records;

describe('joinRoster', () => {
  it('left-joins valid Apollo rows and reports every deterministic exception', () => {
    const report = joinRoster(apolloFixture, semrushFixture);

    expect(report.accepted).toHaveLength(2);
    expect(report.accepted[0]).toMatchObject({
      canonicalDomain: 'alpha.example',
      semrush: {classification: 'observed', observedAt: INITIAL_APIFY_OBSERVATION_BATCH},
    });
    expect(report.accepted[0].apollo).not.toHaveProperty('data');
    expect(report.accepted[0].semrush).not.toHaveProperty('data');
    expect(report.rejections).toContainEqual(expect.objectContaining({code: 'missing_apollo_website'}));
    expect(report.unmatchedApollo).toEqual([]);
    expect(report.apifyOnly).toEqual([]);
  });

  it('keeps valid Apollo roster members without enrichment and reports Apify-only domains', () => {
    const report = joinRoster([
      ...apolloFixture.slice(0, 1),
      {'Company Name': 'Gamma', Website: 'https://gamma.example', 'Apollo Account Id': 'acct-gamma', 'Apollo Record Id': 'rec-gamma'},
    ], semrushFixture);

    expect(report.accepted).toHaveLength(2);
    expect(report.accepted.find((item) => item.canonicalDomain === 'gamma.example')?.semrush.records).toEqual([]);
    expect(report.unmatchedApollo).toEqual([expect.objectContaining({canonicalDomain: 'gamma.example'})]);
    expect(report.apifyOnly).toEqual([expect.objectContaining({canonicalDomain: 'beta.example'})]);
    expect(report.rejections).toContainEqual(expect.objectContaining({code: 'apify_only'}));
  });

  it('rejects duplicate Apollo domains and conflicting Apollo IDs', () => {
    const duplicateDomain = {...apolloFixture[0], 'Apollo Account Id': 'acct-other', 'Apollo Record Id': 'rec-other'};
    const duplicateAccount = {...apolloFixture[1], 'Apollo Account Id': apolloFixture[0]['Apollo Account Id']};
    const report = joinRoster([apolloFixture[0], duplicateDomain, duplicateAccount], semrushFixture);

    expect(report.accepted).toEqual([]);
    expect(report.rejections.filter((item) => item.code === 'duplicate_apollo_domain')).toHaveLength(2);
    expect(report.rejections.filter((item) => item.code === 'conflicting_apollo_source_identity')).toHaveLength(2);
  });

  it('collapses canonical duplicate Semrush observations and rejects conflicts in the initial batch', () => {
    const duplicate = structuredClone(semrushFixture[0]);
    const conflicting = {...structuredClone(semrushFixture[0]), organic_traffic: 999};
    const collapsed = joinRoster(apolloFixture.slice(0, 1), [semrushFixture[0], duplicate]);
    const rejected = joinRoster(apolloFixture.slice(0, 1), [semrushFixture[0], conflicting]);

    expect(collapsed.accepted[0].semrush.records).toHaveLength(1);
    expect(rejected.accepted).toEqual([]);
    expect(rejected.rejections).toContainEqual(expect.objectContaining({code: 'conflicting_semrush_observation', apolloIndex: 0}));
  });

  it('keeps observations from separate databases distinct', () => {
    const canada = {...structuredClone(semrushFixture[0]), database: 'ca'} as SemrushDomainOverview;
    const report = joinRoster(apolloFixture.slice(0, 1), [semrushFixture[0], canada]);

    expect(report.accepted[0].semrush.records).toHaveLength(2);
  });
});
