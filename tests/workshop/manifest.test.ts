import {describe, expect, it} from 'vitest';
import {loadWorkshopManifest, validateWorkshopTimeline} from '@/lib/workshop/manifest';

describe('workshop manifest', () => {
  it('defines a contiguous 90-minute show with an immutable final proof block', () => {
    const manifest = loadWorkshopManifest('workshop/workshop-manifest.json');
    expect(validateWorkshopTimeline(manifest)).toEqual({minutes: 90, contiguous: true});
    expect(manifest.segments.at(-1)).toMatchObject({id: 'proof', startMinute: 85, endMinute: 90});
  });
  it('routes every live segment to a prepared fallback', () => {
    const manifest = loadWorkshopManifest('workshop/workshop-manifest.json');
    for (const segment of manifest.segments.filter((item) => item.liveDependency)) expect(segment.fallbackArtifact).toMatch(/^workshop\//);
  });
});
