export const WORKSHOP_CHECKPOINTS = [
  {tag: 'workshop/cp0-start', subject: 'docs: design live competitor workshop'},
  {tag: 'workshop/cp1-source', subject: 'feat: generate compact workshop data context'},
  {tag: 'workshop/cp2-data', subject: 'feat: add secret-safe workshop preflight'},
  {tag: 'workshop/cp3-design', subject: 'docs: add compact Claude workshop packets'},
  {tag: 'workshop/cp4-app', subject: 'docs: add workshop instructor runbook'},
  {tag: 'workshop/cp5-deployed', subject: 'feat: verify replayable workshop release'},
] as const;

export type CommitEntry = {hash: string; subject: string};
export type ResolvedCheckpoint = {tag: string; hash: string; subject: string};

export function resolveCheckpointCommits(entries: CommitEntry[]): ResolvedCheckpoint[] {
  return WORKSHOP_CHECKPOINTS.map((checkpoint) => {
    const matches = entries.filter((entry) => entry.subject === checkpoint.subject);
    if (matches.length !== 1) throw new Error(`${checkpoint.tag}: expected one commit for subject, found ${matches.length}`);
    return {...checkpoint, hash: matches[0].hash};
  });
}
