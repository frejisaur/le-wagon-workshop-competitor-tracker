import {createHash} from 'node:crypto';
import {existsSync, readFileSync} from 'node:fs';
import {relative, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

import {buildSchemaDocument} from '../.agents/skills/competitor-data-contracts/scripts/generate-semrush-schema.mjs';

const inputRelative = 'data/apify/apollo-accounts-semrush-scraper.json';
const referenceRelative = '.agents/skills/competitor-data-contracts/references/semrush-domain-overview-schema.md';

function summaryValue(document, property) {
  const match = document.match(new RegExp(`^\\| ${property} \\| (?:\`([^\`]*)\`|([^|]*?)) \\|$`, 'm'));
  if (!match) throw new Error(`Schema reference is missing ${property}`);
  return (match[1] ?? match[2]).trim();
}

function validateReference(document) {
  if (summaryValue(document, 'Source') !== inputRelative) throw new Error('Schema reference source is invalid');
  if (!/^[a-f0-9]{64}$/.test(summaryValue(document, 'SHA-256'))) throw new Error('Schema reference hash is invalid');
  const bytes = Number(summaryValue(document, 'Bytes'));
  const records = Number(summaryValue(document, 'Records analyzed'));
  if (!Number.isSafeInteger(bytes) || bytes <= 0) throw new Error('Schema reference byte count is invalid');
  if (records !== 52) throw new Error('Schema reference record count is invalid');
  for (const property of ['Top-level fields', 'Object paths', 'Array paths', 'Scalar paths']) {
    const count = Number(summaryValue(document, property));
    if (!Number.isSafeInteger(count) || count <= 0) throw new Error(`Schema reference ${property} is invalid`);
  }
  for (const heading of ['## Root record fields', '## Object shapes', '## Array shapes', '## Scalar field inventory']) {
    if (!document.includes(heading)) throw new Error(`Schema reference is missing ${heading}`);
  }
  return records;
}

export async function verifySemrushSchemaReference({root = process.cwd()} = {}) {
  const repositoryRoot = resolve(root);
  const inputPath = resolve(repositoryRoot, inputRelative);
  const referencePath = resolve(repositoryRoot, referenceRelative);
  const reference = readFileSync(referencePath, 'utf8');
  const records = validateReference(reference);

  if (!existsSync(inputPath)) return {mode: 'reference-only', records};

  const source = readFileSync(inputPath);
  const payload = JSON.parse(source.toString('utf8'));
  const generated = buildSchemaDocument(payload, {
    sourceName: relative(repositoryRoot, inputPath),
    sourceBytes: source.byteLength,
    sourceSha256: createHash('sha256').update(source).digest('hex'),
  });
  if (generated !== reference) throw new Error('Schema reference is stale');
  return {mode: 'source-check', records: payload.length};
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const result = await verifySemrushSchemaReference();
  console.log(`Schema release gate passed (${result.mode}, ${result.records} records)`);
}
