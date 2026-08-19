import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';

const role = (harness: 'claude' | 'codex', name: string) => readFileSync(`.${harness}/agents/${name}.${harness === 'claude' ? 'md' : 'toml'}`, 'utf8');

describe('focused-agent parity', () => {
  it.each(['pipeline-builder', 'dashboard-builder', 'evidence-reviewer'])('%s exists in both harnesses with the same boundary', (name) => {
    const claude = role('claude', name);
    const codex = role('codex', name);
    expect(claude).toContain(name);
    expect(codex).toContain(name);
    if (name === 'pipeline-builder') for (const definition of [claude, codex]) for (const term of ['competitor-data-contracts', 'raw provider', 'sanitized fixture']) expect(definition.toLowerCase()).toContain(term);
    if (name === 'dashboard-builder') for (const definition of [claude, codex]) for (const term of ['building-competitor-dashboard', 'validated domain types', 'deployment configuration']) expect(definition.toLowerCase()).toContain(term);
    if (name === 'evidence-reviewer') {
      expect(claude).toMatch(/read-only|without editing/i);
      expect(codex).toMatch(/read-only|without editing/i);
      expect(claude).toMatch(/secret exposure/i);
      expect(codex).toMatch(/secret exposure/i);
    }
  });
});
