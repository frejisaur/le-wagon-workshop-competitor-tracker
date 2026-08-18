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
    const current = {companyId: 'company-alpha', canonicalDomain: 'alpha.example', evidence: [{ref: 'company:company-alpha:metric:organic_traffic', value: 200}]};
    const changed = {companyId: 'company-alpha', canonicalDomain: 'alpha.example', evidence: [{ref: 'company:company-alpha:metric:organic_traffic', value: 201}]};

    expect(fingerprintEvidence(current)).not.toBe(fingerprintEvidence(changed));
  });

  it('projects only top-level package fields while preserving nested evidence objects and arrays losslessly', () => {
    const current = {
      companyId: 'company-alpha', canonicalDomain: 'alpha.example',
      evidence: [{ref: 'company:company-alpha:metric:organic_traffic', value: {review: {state: 'one'}, values: [0, {nested: true}]}}],
      review: {untrustedReviewerNotes: 'top-level metadata must not affect evidence'},
    };
    const changedNestedReview = {
      ...current,
      evidence: [{...current.evidence[0], value: {review: {state: 'two'}, values: [0, {nested: true}]}}],
      review: {untrustedReviewerNotes: 'different top-level metadata'},
    };
    const reordered = {
      evidence: [{value: {values: [0, {nested: true}], review: {state: 'one'}}, ref: 'company:company-alpha:metric:organic_traffic'}],
      canonicalDomain: 'alpha.example', companyId: 'company-alpha', runId: 'ignored-top-level-run-id',
    };

    expect(fingerprintEvidence(current)).not.toBe(fingerprintEvidence(changedNestedReview));
    expect(fingerprintEvidence(current)).toBe(fingerprintEvidence(reordered));
  });

  it('normalizes negative zero to zero and rejects non-JSON evidence values instead of dropping them', () => {
    const packageFor = (value: unknown) => ({companyId: 'company-alpha', canonicalDomain: 'alpha.example', evidence: [{ref: 'company:company-alpha:metric:test', value}]});

    expect(fingerprintEvidence(packageFor(-0))).toBe(fingerprintEvidence(packageFor(0)));
    expect(() => fingerprintEvidence(packageFor(Number.NaN))).toThrow(/JSON-serializable/);
    expect(() => fingerprintEvidence(packageFor(Infinity))).toThrow(/JSON-serializable/);
    expect(() => fingerprintEvidence(packageFor([1, undefined]))).toThrow(/JSON-serializable/);
    expect(() => fingerprintEvidence(packageFor({retained: 1, unsupported: undefined}))).toThrow(/JSON-serializable/);
  });
});
