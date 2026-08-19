import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';

describe('workshop credential runbook', () => {
  it('documents OAuth and runtime credentials without token-shaped values', () => {
    const text = readFileSync('workshop/credentials.md', 'utf8');
    for (const command of ['claude mcp add --transport http airtable https://mcp.airtable.com/mcp', 'railway mcp install --agent claude-code --remote --oauth', 'railway login']) expect(text).toContain(command);
    for (const heading of ['Create', 'Store', 'Verify', 'Rotate', 'Revoke']) expect(text).toContain(heading);
    expect(text).not.toMatch(/pat[A-Za-z0-9]+\.[A-Za-z0-9]+|Authorization:\s*Bearer\s+\S+/);
  });
});
