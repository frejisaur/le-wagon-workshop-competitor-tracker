import {pathToFileURL} from 'node:url';
import {runWorkshopPreflight, type WorkshopPhase} from '@/lib/workshop/preflight';

function parseArguments(args: string[]): {phase: WorkshopPhase; json: boolean} {
  let phase: WorkshopPhase = 'all'; let json = false;
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--json') { json = true; continue; }
    if (args[index] === '--phase') {
      const value = args[index + 1];
      if (!['data', 'ui', 'deploy', 'all'].includes(value)) throw new TypeError('--phase must be data, ui, deploy, or all');
      phase = value as WorkshopPhase; index += 1; continue;
    }
    throw new TypeError(`unsupported argument: ${args[index]}`);
  }
  return {phase, json};
}

export async function runWorkshopPreflightCli(args: string[]): Promise<{exitCode: number; stdout: string}> {
  try {
    const options = parseArguments(args); const report = await runWorkshopPreflight({phase: options.phase});
    const stdout = options.json ? JSON.stringify(report) : report.checks.map((check) => `${check.category} ${check.name} ${check.status}`).join('\n');
    return {exitCode: report.ready ? 0 : 1, stdout};
  } catch { return {exitCode: 1, stdout: 'workshop preflight failed'}; }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const result = await runWorkshopPreflightCli(process.argv.slice(2)); process.stdout.write(`${result.stdout}\n`); process.exitCode = result.exitCode;
}
