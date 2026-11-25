import {appendFileSync, existsSync, readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {formatAnnotation, formatStepSummary, summarizeEnrichOutput} from '@/lib/refresh/report';

/**
 * Runs after `npm run enrich` in the refresh workflow, whatever its outcome. It
 * writes the run page summary and one annotation that a dispatcher can read back
 * through the GitHub API. It always exits zero: the enrich step owns the verdict.
 */
export function publishRefreshReport(reportPath: string | undefined, env: NodeJS.Dict<string> = process.env): string {
  const output = reportPath && existsSync(reportPath) ? readFileSync(reportPath, 'utf8') : '';
  const summary = summarizeEnrichOutput(output);
  if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, formatStepSummary(summary), 'utf8');
  return formatAnnotation(summary);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  process.stdout.write(`${publishRefreshReport(process.argv[2])}\n`);
}
