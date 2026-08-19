import {describe, expect, it} from 'vitest';
import {verifyWorkshopRelease} from '@/lib/workshop/release';

describe('workshop release gate', () => {
  it('accepts the complete replayable workshop bundle', () => {
    expect(verifyWorkshopRelease('.')).toEqual({ready: true, missing: [], invalid: []});
  });
});
