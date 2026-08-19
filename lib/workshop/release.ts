import {existsSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import {loadWorkshopManifest, validateWorkshopTimeline} from './manifest';
import {auditSkillCandidate} from './skill-audit';

export type WorkshopReleaseReport = {ready: boolean; missing: string[]; invalid: Array<{file: string; rule: string}>};

const instructor = ['workshop/README.md','workshop/run-of-show.md','workshop/speaker-script.md','workshop/checkpoints.md','workshop/replay.md','workshop/credentials.md','workshop/preflight.md'];
const prompts = Array.from({length: 7}, (_, index) => `workshop/prompts/0${index + 1}-${['inspect-apify','author-data-skill','run-data-join','setup-airtable','author-dashboard-skill','build-dashboard','deploy-railway'][index]}.md`);
const starters = ['workshop/starters/data-join-brief.md','workshop/starters/dashboard-design-brief.md'];
const design = ['workshop/design/all-companies-option-a.html','workshop/design/all-companies-option-b.html','workshop/design/all-companies-option-c.html','workshop/design/selected-all-companies.html','workshop/design/company-detail-reference.html','workshop/design/dashboard-fixture.json'];
const expected = ['workshop/context/provider-summary.json','workshop/context/expected-counts.json','workshop/expected/data-join-output.json','workshop/expected/preflight-output.json','workshop/expected/airtable-import-output.json','workshop/expected/railway-health-output.json'];
const secretPattern = /pat[A-Za-z0-9]+\.[A-Za-z0-9]+|Authorization:\s*Bearer\s+\S+/i;

export function verifyWorkshopRelease(root: string): WorkshopReleaseReport {
  const missing: string[] = []; const invalid: Array<{file: string; rule: string}> = [];
  const manifestPath = join(root, 'workshop/workshop-manifest.json');
  if (!existsSync(manifestPath)) return {ready: false, missing: ['workshop/workshop-manifest.json'], invalid};
  let manifest;
  try { manifest = loadWorkshopManifest(manifestPath); } catch { return {ready: false, missing, invalid: [{file: 'workshop/workshop-manifest.json', rule: 'manifest-schema'}]}; }
  const paths = [...manifest.contextPackets, ...manifest.canonicalSkills, ...manifest.segments.flatMap((segment) => segment.fallbackArtifact ? [segment.fallbackArtifact] : []), ...instructor, ...prompts, ...starters, ...design, ...expected];
  for (const file of [...new Set(paths)]) if (!existsSync(join(root, file))) missing.push(file);
  const timeline = validateWorkshopTimeline(manifest);
  if (timeline.minutes !== 90 || !timeline.contiguous) invalid.push({file: 'workshop/workshop-manifest.json', rule: '90-minute-contiguous-timeline'});
  for (const file of manifest.contextPackets) if (existsSync(join(root, file))) {
    const text = readFileSync(join(root, file), 'utf8');
    if (text.trim().split(/\s+/).length > 1200) invalid.push({file, rule: 'packet-word-budget'});
  }
  for (const file of [...instructor, ...prompts, ...starters, ...manifest.contextPackets]) if (existsSync(join(root, file)) && secretPattern.test(readFileSync(join(root, file), 'utf8'))) invalid.push({file, rule: 'credential-shaped-content'});
  for (const [file, contract] of [[manifest.canonicalSkills[0], 'data'], [manifest.canonicalSkills[1], 'dashboard']] as const) if (existsSync(join(root, file))) {
    const text = readFileSync(join(root, file), 'utf8');
    if (!auditSkillCandidate(text, text, contract).valid) invalid.push({file, rule: 'canonical-skill-contract'});
  }
  for (const file of ['workshop/context/expected-counts.json','workshop/expected/data-join-output.json']) if (existsSync(join(root, file))) {
    try { const value = JSON.parse(readFileSync(join(root, file), 'utf8')); if (!value || typeof value !== 'object') throw new Error(); } catch { invalid.push({file, rule: 'expected-count-json'}); }
  }
  missing.sort(); invalid.sort((a,b) => `${a.file}:${a.rule}`.localeCompare(`${b.file}:${b.rule}`));
  return {ready: missing.length === 0 && invalid.length === 0, missing, invalid};
}
