import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';

describe('instructor documentation', () => {
  it('covers every manifest segment and every recovery trigger', () => {
    const manifest = JSON.parse(readFileSync('workshop/workshop-manifest.json', 'utf8')) as {segments: Array<{id: string}>};
    const script = readFileSync('workshop/speaker-script.md', 'utf8');
    for (const segment of manifest.segments) expect(script).toContain(`segment:${segment.id}`);
    for (const trigger of ['90 seconds', 'fails twice', 'segment boundary', 'unreadable']) expect(readFileSync('workshop/checkpoints.md', 'utf8')).toContain(trigger);
  });
});
