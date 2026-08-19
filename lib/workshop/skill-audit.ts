export type SkillContract = 'data' | 'dashboard';
export type SkillAuditResult = {valid: boolean; wordCount: number; missingRules: string[]; overlappingName: boolean; canonicalPathRecommended: boolean};

const rules: Record<SkillContract, Array<[string, RegExp]>> = {
  data: [
    ['observed', /observed/i], ['calculated', /calculated|reproducible calculation/i], ['inferred', /inferred|agent inference/i],
    ['canonical domain', /canonical[_ -]?domain|stable record identit/i], ['join', /join/i], ['exception', /exception|rejection/i],
    ['sanitized fixture', /sanitized fixture/i], ['test', /test/i],
  ],
  dashboard: [
    ['All Companies', /All Companies/i], ['Company Detail', /Company Detail/i], ['evidence', /evidence/i], ['observed', /observed/i],
    ['calculated', /calculated|deterministic calculations?/i], ['inferred', /inferred|agent interpretation/i], ['responsive', /responsive|desktop.*tablet.*mobile/is],
    ['keyboard', /keyboard/i], ['empty', /empty/i], ['test', /test/i],
  ],
};

function frontmatter(text: string): {name?: string; description?: string} {
  const match = text.match(/^---\n([\s\S]*?)\n---/); if (!match) return {};
  const name = match[1].match(/^name:\s*(.+)$/m)?.[1].trim();
  const description = match[1].match(/^description:\s*(.+)$/m)?.[1].trim();
  return {name, description};
}

export function auditSkillCandidate(candidate: string, canonical: string, contract: SkillContract): SkillAuditResult {
  const candidateMeta = frontmatter(candidate); const canonicalMeta = frontmatter(canonical);
  const wordCount = candidate.trim() ? candidate.trim().split(/\s+/).length : 0;
  const missingRules = rules[contract].filter(([, pattern]) => !pattern.test(candidate)).map(([label]) => label);
  if (!candidateMeta.name) missingRules.unshift('frontmatter name');
  if (!candidateMeta.description || !/^Use when\b/i.test(candidateMeta.description)) missingRules.unshift('trigger description');
  if (!/workflow|steps?/i.test(candidate)) missingRules.push('workflow');
  if (!/boundar|do not|never/i.test(candidate)) missingRules.push('boundaries');
  if (!/handoff|report|return/i.test(candidate)) missingRules.push('handoff');
  if (!/(?:```(?:bash|sh)?[\s\S]*?(?:npm|node)[\s\S]*?```|run the focused test|tests? run)/i.test(candidate)) missingRules.push('verification command');
  if (wordCount > 1500) missingRules.push('word budget');
  const overlappingName = Boolean(candidateMeta.name && canonicalMeta.name && candidateMeta.name !== canonicalMeta.name);
  const valid = missingRules.length === 0 && !overlappingName;
  return {valid, wordCount, missingRules: [...new Set(missingRules)], overlappingName, canonicalPathRecommended: valid};
}
