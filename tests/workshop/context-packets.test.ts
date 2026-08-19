import {existsSync, readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';

const packets = ['01-data-join-brief.md', '02-airtable-brief.md', '03-dashboard-brief.md', '04-railway-brief.md'];

describe('Claude workshop context packets', () => {
  it.each(packets)('%s stays bounded and points to context instead of embedding it', (name) => {
    const text = readFileSync(`workshop/context/${name}`, 'utf8');
    expect(text.trim().split(/\s+/).length).toBeLessThan(1201);
    for (const heading of ['## Outcome', '## Non-goals', '## Read', '## Run', '## Acceptance', '## Return']) expect(text).toContain(heading);
    expect(text).not.toMatch(/pat[A-Za-z0-9]+\.[A-Za-z0-9]+|Authorization:\s*Bearer\s+\S+/);
    for (const path of text.match(/`(?:\.?\.?\/)?[\w./-]+\.[\w]+`/g) ?? []) {
      const cleaned = path.slice(1, -1);
      if (!cleaned.startsWith('npm') && !cleaned.includes(' ')) expect(existsSync(cleaned), `${cleaned} should resolve`).toBe(true);
    }
  });
});
