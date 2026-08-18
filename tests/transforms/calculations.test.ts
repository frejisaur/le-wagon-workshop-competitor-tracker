import {describe, expect, it} from 'vitest';
import {
  buildLandingPagePortfolio,
  calculateBenchmarkGap,
  calculateMovement,
  calculateNonBrandShare,
  calculateTrackedSetShare,
} from '@/lib/transforms/calculations';
import {parseCompactNumber} from '@/lib/transforms/parse-provider-number';

describe('provider number parsing', () => {
  it('parses compact values without discarding their provider representation', () => {
    expect(parseCompactNumber('1.6k')).toEqual({raw: '1.6k', normalized: 1600});
    expect(parseCompactNumber('3%')).toEqual({raw: '3%', normalized: 0.03});
    expect(parseCompactNumber(' 2.5M ')).toEqual({raw: ' 2.5M ', normalized: 2_500_000});
  });

  it('does not convert invalid or nonfinite provider values into a number', () => {
    expect(parseCompactNumber('not available')).toEqual({raw: 'not available', normalized: null});
    expect(parseCompactNumber('Infinity')).toEqual({raw: 'Infinity', normalized: null});
    expect(parseCompactNumber(null)).toEqual({raw: null, normalized: null});
  });
});

describe('deterministic calculations', () => {
  it('sorts points and compares the latest value with the point at or before the window target', () => {
    expect(calculateMovement([
      {date: '2026-03-02', value: 125},
      {date: '2026-01-31', value: 100},
      {date: '2026-02-01', value: 110},
    ], 30)).toBe(0.25);
  });

  it('returns null for a missing, nonfinite, or zero movement baseline', () => {
    expect(calculateMovement([{date: '2026-01-01', value: 0}, {date: '2026-02-01', value: 10}], 30)).toBeNull();
    expect(calculateMovement([{date: '2026-01-01', value: Number.NaN}, {date: '2026-02-01', value: 10}], 30)).toBeNull();
    expect(calculateMovement([{date: '2026-02-01', value: 10}], 30)).toBeNull();
  });

  it('calculates all ratios with null for missing or zero denominators', () => {
    expect(calculateNonBrandShare(30, 70)).toBe(0.7);
    expect(calculateNonBrandShare(0, 0)).toBeNull();
    expect(calculateTrackedSetShare(25, 100)).toBe(0.25);
    expect(calculateTrackedSetShare(25, 0)).toBeNull();
    expect(calculateBenchmarkGap(2, 5)).toBe(-3);
    expect(calculateBenchmarkGap(null, 5)).toBeNull();
  });

  it('groups keyword samples by normalized landing page without treating malformed URLs as pages', () => {
    expect(buildLandingPagePortfolio([
      {keyword: 'alpha', url: 'HTTPS://alpha.example/offer#details', traffic: 5},
      {keyword: 'beta', url: 'https://alpha.example/offer', traffic: 3},
      {keyword: 'unsafe', url: 'http://localhost/offer', traffic: 100},
    ])).toEqual([{
      normalizedLandingUrl: 'https://alpha.example/offer',
      keywordCount: 2,
      estimatedTraffic: 8,
      keywords: ['alpha', 'beta'],
    }]);
  });
});
