import {readFileSync} from 'node:fs';
import {expect, it} from 'vitest';
import {planApolloAdoption} from '@/lib/workflows/adopt-apollo';
import type {AirtableRecord} from '@/lib/airtable/types';
const source = readFileSync('tests/fixtures/providers/apollo-sample.csv','utf8');
const legacy: AirtableRecord[] = ['alpha','beta','missing'].map(name => ({
  id: 'rec-' + name, fields: {'Apollo Account ID': 'acct-' + name, 'Canonical Domain': name === 'missing' ? '' : name + '.example',
    'Match Status': name === 'missing' ? 'missing_apollo_website' : 'matched', 'Review • Notes':'retained'},
}));
it('adopts only exact legacy matches and limits removal to the confirmed missing source website', () => {
  const plan = planApolloAdoption(source, legacy);
  expect(plan.missingWebsiteIds).toEqual(['rec-missing']);
  expect(plan.updates.map(row=>row.id)).toEqual(['rec-alpha','rec-beta']);
  expect(plan.updates[0].fields).not.toHaveProperty('Review • Notes');
  const replay = legacy.slice(0,2).map((r,i)=>({...r,fields:{...r.fields,...plan.updates[i].fields}})) as AirtableRecord[];
  expect(planApolloAdoption(source,replay)).toEqual({updates:[],missingWebsiteIds:[]});
});
it('aborts before mutation on duplicate identities, unrelated rows or contradictory website evidence', () => {
  expect(()=>planApolloAdoption(source,[...legacy,legacy[0]])).toThrow();
  expect(()=>planApolloAdoption(source,legacy.slice(1))).toThrow();
  expect(()=>planApolloAdoption(source,[...legacy.slice(0,2),{...legacy[2],fields:{...legacy[2].fields,Website:'real.example'}}])).toThrow();
});
