import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {buildWorkshopContext} from '@/lib/workshop/context-generator';

type Arguments = {apollo: string; semrush: string; sourceLabel: string; generatedAt: string; outputDir: string};

function parseArguments(args: string[]): Arguments {
  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index += 2) {
    const name = args[index];
    const value = args[index + 1];
    if (!name?.startsWith('--') || !value || value.startsWith('--')) throw new TypeError('workshop context flags require values');
    values.set(name.slice(2), value);
  }
  const required = ['apollo', 'semrush', 'source-label', 'generated-at', 'output-dir'] as const;
  for (const name of required) if (!values.get(name)) throw new TypeError(`--${name} is required`);
  return {
    apollo: values.get('apollo')!, semrush: values.get('semrush')!, sourceLabel: values.get('source-label')!,
    generatedAt: values.get('generated-at')!, outputDir: values.get('output-dir')!,
  };
}

export function runGenerateWorkshopContext(args: string[]): {files: string[]} {
  const options = parseArguments(args);
  const result = buildWorkshopContext({
    apolloCsv: readFileSync(options.apollo, 'utf8'), semrushJson: readFileSync(options.semrush, 'utf8'),
    sourceLabel: options.sourceLabel, generatedAt: options.generatedAt,
  });
  const contextDir = join(options.outputDir, 'context');
  const expectedDir = join(options.outputDir, 'expected');
  mkdirSync(contextDir, {recursive: true});
  mkdirSync(expectedDir, {recursive: true});
  const outputs: Array<[string, unknown]> = [
    [join(contextDir, 'provider-summary.json'), result.providerSummary],
    [join(contextDir, 'expected-counts.json'), result.expectedCounts],
    [join(expectedDir, 'data-join-output.json'), {status: 'ready', ...result.expectedCounts}],
  ];
  outputs.forEach(([path, value]) => writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`));
  return {files: outputs.map(([path]) => path)};
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  try { process.stdout.write(`${JSON.stringify(runGenerateWorkshopContext(process.argv.slice(2)))}\n`); }
  catch { process.stdout.write('{"status":"failed","error":"workshop_context_generation_failed"}\n'); process.exitCode = 1; }
}
