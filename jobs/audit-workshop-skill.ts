import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {auditSkillCandidate, type SkillContract} from '@/lib/workshop/skill-audit';

function value(args: string[], flag: string): string { const index = args.indexOf(flag); const result = args[index + 1]; if (index < 0 || !result) throw new TypeError(`${flag} is required`); return result; }
export function runAuditWorkshopSkill(args: string[]): {exitCode: number; stdout: string} {
  try {
    const contract = value(args, '--contract') as SkillContract; if (!['data', 'dashboard'].includes(contract)) throw new TypeError('invalid contract');
    const result = auditSkillCandidate(readFileSync(value(args, '--candidate'), 'utf8'), readFileSync(value(args, '--canonical'), 'utf8'), contract);
    return {exitCode: result.valid ? 0 : 1, stdout: JSON.stringify(result)};
  } catch { return {exitCode: 1, stdout: '{"valid":false,"error":"skill_audit_failed"}'}; }
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) { const result = runAuditWorkshopSkill(process.argv.slice(2)); process.stdout.write(`${result.stdout}\n`); process.exitCode = result.exitCode; }
