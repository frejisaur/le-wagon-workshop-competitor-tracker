import {describe, expect, it} from 'vitest';
import {fingerprintEvidence} from '@/lib/agents/evidence/fingerprint';

describe('fingerprintEvidence', () => {
  it('is stable across object key order and excludes run metadata and generated prose', () => {
    const evidence = {
      companyId: 'company-alpha',
      evidence: [
        {ref: 'company:company-alpha:metric:organic_traffic', classification: 'observed', source: 'semrush', value: 200},
      ],
      publication: {runId: 'run-a', generatedAt: '2026-08-18T00:00:00.000Z', summary: 'Generated insight prose'},
    };
    const reordered = {
      publication: {summary: 'Different generated prose', generatedAt: '2026-09-18T00:00:00.000Z', runId: 'run-b'},
      evidence: [{value: 200, source: 'semrush', classification: 'observed', ref: 'company:company-alpha:metric:organic_traffic'}],
      companyId: 'company-alpha',
    };

    expect(fingerprintEvidence(evidence)).toBe(fingerprintEvidence(reordered));
  });

  it('changes when a canonical evidence scalar changes', () => {
    const current = {evidence: [{ref: 'company:company-alpha:metric:organic_traffic', value: 200}]};
    const changed = {evidence: [{ref: 'company:company-alpha:metric:organic_traffic', value: 201}]};

    expect(fingerprintEvidence(current)).not.toBe(fingerprintEvidence(changed));
  });
});
