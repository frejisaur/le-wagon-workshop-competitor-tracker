import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';

const definition = (name: string) => readFileSync(`.claude/agents/${name}.md`, 'utf8');

describe('focused agent boundaries', () => {
  it.each([
    ['pipeline-builder', ['competitor-data-contracts', 'raw provider', 'sanitized fixture']],
    ['dashboard-builder', ['building-competitor-dashboard', 'validated domain types', 'deployment configuration']],
  ])('%s names its skill and boundary', (name, terms) => {
    const text = definition(name).toLowerCase();
    expect(text).toContain(name);
    for (const term of terms) expect(text).toContain(term);
  });

  it('keeps the evidence reviewer read-only and watching for secret exposure', () => {
    const text = definition('evidence-reviewer');
    expect(text).toMatch(/read-only|without editing/i);
    expect(text).toMatch(/secret exposure/i);
  });
});
