import {describe, expect, it} from 'vitest';
import {resolveCheckpointCommits, WORKSHOP_CHECKPOINTS} from '@/lib/workshop/checkpoints';

describe('workshop checkpoint resolution', () => {
  const entries = WORKSHOP_CHECKPOINTS.map((item, index) => ({hash: `${index}`.repeat(40), subject: item.subject}));
  it('resolves unique subjects in checkpoint order', () => expect(resolveCheckpointCommits(entries).map((item) => item.tag)).toEqual(WORKSHOP_CHECKPOINTS.map((item) => item.tag)));
  it('rejects a missing subject before any Git mutation', () => expect(() => resolveCheckpointCommits(entries.slice(1))).toThrow(/expected one/));
  it('rejects duplicate subjects before any Git mutation', () => expect(() => resolveCheckpointCommits([...entries, entries[0]])).toThrow(/found 2/));
});
