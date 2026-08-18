#!/usr/bin/env node

import {createHash} from 'node:crypto';
import {existsSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, relative, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

function valueType(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function valueFormat(value) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return 'non-finite-number';
    return Number.isInteger(value) ? 'integer' : 'decimal';
  }
  if (typeof value !== 'string') return null;
  if (value === '') return 'empty-string';
  if (/^https?:\/\//i.test(value)) return 'url';
  if (/^[+-]?\d+(?:\.\d+)?%$/.test(value)) return 'percentage';
  if (/^[+-]?\d+(?:\.\d+)?[kmbt]$/i.test(value)) return 'compact-number';
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) return 'iso-datetime';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'iso-date';
  if (/^[+-]?\d+(?:\.\d+)?$/.test(value)) return 'numeric-string';
  if (/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i.test(value)) return 'domain';
  return null;
}

function createNodeStat() {
  return {
    types: new Set(),
    records: new Set(),
    occurrences: 0,
    nulls: 0,
    formats: new Set(),
  };
}

function addNode(stats, path, value, recordIndex) {
  const stat = stats.get(path) ?? createNodeStat();
  stat.types.add(valueType(value));
  stat.records.add(recordIndex);
  stat.occurrences += 1;
  if (value === null) stat.nulls += 1;
  const format = valueFormat(value);
  if (format) stat.formats.add(format);
  stats.set(path, stat);
}

function sortText(values) {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function formatNumber(value) {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(1).replace(/\.0$/, '');
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function code(value) {
  return `\`${String(value).replaceAll('`', '\\`')}\``;
}

function coverage(stat, recordCount) {
  return `${stat.records.size}/${recordCount}`;
}

function collectSchema(records) {
  const nodes = new Map();
  const scalarPaths = new Set();
  const objectShapes = new Map();
  const arrays = new Map();
  const topLevelFields = new Set();

  function visit(value, path, recordIndex) {
    if (path) addNode(nodes, path, value, recordIndex);

    if (Array.isArray(value)) {
      const stat = arrays.get(path) ?? {
        records: new Set(),
        lengths: [],
        itemTypes: new Set(),
      };
      stat.records.add(recordIndex);
      stat.lengths.push(value.length);
      for (const item of value) stat.itemTypes.add(valueType(item));
      arrays.set(path, stat);

      for (const item of value) visit(item, `${path}[]`, recordIndex);
      return;
    }

    if (value !== null && typeof value === 'object') {
      if (path) {
        const stat = objectShapes.get(path) ?? {
          records: new Set(),
          instances: 0,
          keys: new Set(),
        };
        stat.records.add(recordIndex);
        stat.instances += 1;
        for (const key of Object.keys(value)) stat.keys.add(key);
        objectShapes.set(path, stat);
      }

      for (const [key, child] of Object.entries(value)) {
        if (!path) topLevelFields.add(key);
        visit(child, path ? `${path}.${key}` : key, recordIndex);
      }
      return;
    }

    if (path) scalarPaths.add(path);
  }

  records.forEach((record, index) => visit(record, '', index));
  return {arrays, nodes, objectShapes, scalarPaths, topLevelFields};
}

export function buildSchemaDocument(records, source = {}) {
  if (!Array.isArray(records)) {
    throw new TypeError('Semrush payload root must be an array of records');
  }

  const recordCount = records.length;
  const {arrays, nodes, objectShapes, scalarPaths, topLevelFields} = collectSchema(records);
  const sourceName = source.sourceName ?? 'apollo-accounts-semrush-scraper.json';
  const sourceBytes = source.sourceBytes ?? 'unknown';
  const sourceSha256 = source.sourceSha256 ?? 'unknown';
  const lines = [
    '# Observed Semrush Domain Overview schema',
    '',
    '> Generated from the repository payload. This is an observed sample contract,',
    '> not a guarantee that the provider cannot return additional fields or types.',
    '',
    '## Contents',
    '',
    '- [Source summary](#source-summary)',
    '- [Root record fields](#root-record-fields)',
    '- [Object shapes](#object-shapes)',
    '- [Array shapes](#array-shapes)',
    '- [Scalar field inventory](#scalar-field-inventory)',
    '',
    '## Source summary',
    '',
    '| Property | Value |',
    '|---|---:|',
    `| Source | ${code(sourceName)} |`,
    `| SHA-256 | ${code(sourceSha256)} |`,
    `| Bytes | ${sourceBytes} |`,
    `| Records analyzed | ${recordCount} |`,
    `| Top-level fields | ${topLevelFields.size} |`,
    `| Object paths | ${objectShapes.size} |`,
    `| Array paths | ${arrays.size} |`,
    `| Scalar paths | ${scalarPaths.size} |`,
    '',
    'Paths use `[]` for an array item. Coverage is the number of root company',
    'records containing a path, not the number of nested objects. `Values` counts',
    'all observed scalar occurrences. Formats are inferred conservatively from',
    'values; an empty format cell means no special representation was detected.',
    '',
    '## Root record fields',
    '',
    '| Field | Observed types | Record coverage | Values/instances | Nulls | Formats |',
    '|---|---|---:|---:|---:|---|',
  ];

  for (const field of sortText(topLevelFields)) {
    const stat = nodes.get(field);
    lines.push(
      `| ${code(field)} | ${sortText(stat.types).join(', ')} | ${coverage(stat, recordCount)} | ${stat.occurrences} | ${stat.nulls} | ${sortText(stat.formats).join(', ')} |`,
    );
  }

  lines.push(
    '',
    '## Object shapes',
    '',
    '| Path | Record coverage | Instances | Observed keys |',
    '|---|---:|---:|---|',
  );
  for (const path of sortText(objectShapes.keys())) {
    const stat = objectShapes.get(path);
    lines.push(
      `| ${code(path)} | ${coverage(stat, recordCount)} | ${stat.instances} | ${sortText(stat.keys).map(code).join(', ')} |`,
    );
  }

  lines.push(
    '',
    '## Array shapes',
    '',
    '| Path | Record coverage | Array instances | Minimum length | Median length | Maximum length | Item types |',
    '|---|---:|---:|---:|---:|---:|---|',
  );
  for (const path of sortText(arrays.keys())) {
    const stat = arrays.get(path);
    const minimum = Math.min(...stat.lengths);
    const maximum = Math.max(...stat.lengths);
    lines.push(
      `| ${code(path)} | ${coverage(stat, recordCount)} | ${stat.lengths.length} | ${minimum} | ${formatNumber(median(stat.lengths))} | ${maximum} | ${sortText(stat.itemTypes).join(', ')} |`,
    );
  }

  lines.push(
    '',
    '## Scalar field inventory',
    '',
    '| Path | Observed types | Record coverage | Values | Nulls | Formats |',
    '|---|---|---:|---:|---:|---|',
  );
  for (const path of sortText(scalarPaths)) {
    const stat = nodes.get(path);
    lines.push(
      `| ${code(path)} | ${sortText(stat.types).join(', ')} | ${coverage(stat, recordCount)} | ${stat.occurrences} | ${stat.nulls} | ${sortText(stat.formats).join(', ')} |`,
    );
  }

  return `${lines.join('\n')}\n`;
}

function parseCli(argv) {
  const check = argv.includes('--check');
  const positional = argv.filter((argument) => argument !== '--check');
  if (positional.length > 2) {
    throw new Error('Usage: generate-semrush-schema.mjs [--check] [input.json] [output.md]');
  }
  return {check, positional};
}

function runCli() {
  const scriptDirectory = dirname(fileURLToPath(import.meta.url));
  const repositoryRoot = resolve(scriptDirectory, '../../../..');
  const defaults = [
    resolve(repositoryRoot, 'apollo-accounts-semrush-scraper.json'),
    resolve(scriptDirectory, '../references/semrush-domain-overview-schema.md'),
  ];
  const {check, positional} = parseCli(process.argv.slice(2));
  const inputPath = resolve(positional[0] ?? defaults[0]);
  const outputPath = resolve(positional[1] ?? defaults[1]);
  const sourceBuffer = readFileSync(inputPath);
  const records = JSON.parse(sourceBuffer.toString('utf8'));
  const document = buildSchemaDocument(records, {
    sourceName: relative(repositoryRoot, inputPath) || inputPath,
    sourceBytes: sourceBuffer.byteLength,
    sourceSha256: createHash('sha256').update(sourceBuffer).digest('hex'),
  });

  if (check) {
    if (!existsSync(outputPath) || readFileSync(outputPath, 'utf8') !== document) {
      console.error(`Schema reference is stale: ${outputPath}`);
      process.exitCode = 1;
      return;
    }
    console.log(`Schema reference is current: ${outputPath}`);
    return;
  }

  writeFileSync(outputPath, document);
  console.log(`Wrote ${outputPath}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  runCli();
}
