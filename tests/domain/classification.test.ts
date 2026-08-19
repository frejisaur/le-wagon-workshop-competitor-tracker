import {describe, expect, expectTypeOf, it} from 'vitest';
import type {ObservedGroup} from '@/lib/domain/classification';

describe('classified object groups', () => {
  it('serialize one direct-field payload with classification metadata only', () => {
    const observed: ObservedGroup<{organicTraffic: number}> = {
      organicTraffic: 300,
      classification: 'observed',
      source: 'semrush',
      observedAt: 'initial-import',
    };

    expect(observed).toEqual({
      organicTraffic: 300,
      classification: 'observed',
      source: 'semrush',
      observedAt: 'initial-import',
    });
    expect(JSON.parse(JSON.stringify(observed))).not.toHaveProperty('data');
    expectTypeOf(observed).toMatchTypeOf<ObservedGroup<{organicTraffic: number}>>();
    // @ts-expect-error Groups intentionally expose no mirrored nested payload.
    observed.data;
  });
});
