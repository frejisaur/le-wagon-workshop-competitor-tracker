import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {resolveCheckpointCommits} from '../lib/workshop/checkpoints';

const apply = process.argv.includes('--apply');
const log = execFileSync('git', ['log', '--format=%H%x09%s'], {encoding: 'utf8'});
const entries = log.trim().split('\n').filter(Boolean).map((line) => { const [hash, ...subject] = line.split('\t'); return {hash, subject: subject.join('\t')}; });
const resolved = resolveCheckpointCommits(entries);
for (const item of resolved) console.log(`${item.tag}\t${item.hash.slice(0, 8)}\t${item.subject}`);
if (apply) {
  process.stdout.write('Type CREATE WORKSHOP TAGS to continue: ');
  const confirmation = readFileSync(0, 'utf8').trim();
  if (confirmation !== 'CREATE WORKSHOP TAGS') throw new Error('confirmation declined');
  const existing = new Set(execFileSync('git', ['tag', '--list', 'workshop/*'], {encoding: 'utf8'}).trim().split('\n').filter(Boolean));
  for (const item of resolved) {
    if (existing.has(item.tag)) throw new Error(`refusing to move existing tag ${item.tag}`);
    execFileSync('git', ['tag', '-a', item.tag, item.hash, '-m', item.subject], {stdio: 'inherit'});
  }
}
