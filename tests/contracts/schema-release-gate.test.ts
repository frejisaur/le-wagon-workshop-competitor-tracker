import {existsSync} from 'node:fs';
import {mkdir, mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {describe, expect, it} from 'vitest';

describe('schema release gate', () => {
  it('validates the committed schema reference when the ignored raw source is absent', async () => {
    const scriptPath = resolve('scripts/verify-semrush-schema-reference.mjs');
    expect(existsSync(scriptPath)).toBe(true);
    if (!existsSync(scriptPath)) return;

    const root = await mkdtemp(join(tmpdir(), 'competitor-schema-gate-'));
    const referenceRelative = '.agents/skills/competitor-data-contracts/references/semrush-domain-overview-schema.md';
    const referencePath = join(root, referenceRelative);
    try {
      await mkdir(dirname(referencePath), {recursive: true});
      await writeFile(referencePath, await readFile(resolve(referenceRelative), 'utf8'));

      const module = await import(pathToFileURL(scriptPath).href) as {
        verifySemrushSchemaReference(options: {root: string}): Promise<{mode: string; records: number}>;
      };
      await expect(module.verifySemrushSchemaReference({root})).resolves.toEqual({
        mode: 'reference-only',
        records: 52,
      });
    } finally {
      await rm(root, {recursive: true, force: true});
    }
  });
});
