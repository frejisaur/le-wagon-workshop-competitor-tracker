import {describe, expect, it} from 'vitest';
import {estimateRecordBudget} from '@/lib/airtable/record-budget';

describe('estimateRecordBudget', () => {
  it('counts the supplied sample under the strict free-plan threshold', () => {
    expect(estimateRecordBudget({companies: 52, keywords: 358, paidAds: 16, insights: 52, reviews: 52, system: 1}))
      .toEqual({total: 531, withinFreeLimit: true});
  });

  it('rejects totals at the 1,000-record limit', () => {
    expect(estimateRecordBudget({companies: 999, keywords: 0, paidAds: 0, insights: 0, reviews: 0, system: 1}))
      .toEqual({total: 1000, withinFreeLimit: false});
  });
});
