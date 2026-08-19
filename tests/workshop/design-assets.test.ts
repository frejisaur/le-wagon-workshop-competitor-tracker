import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';

describe('workshop design assets', () => {
  it('keeps live options comparable and the selected screen contract complete', () => {
    const options = ['a', 'b', 'c'].map((id) => readFileSync(`workshop/design/all-companies-option-${id}.html`, 'utf8'));
    for (const html of options) for (const marker of ['KPI ledger', 'Market map', 'Attention signals', 'Company leaderboard']) expect(html).toContain(marker);
    const selected = readFileSync('workshop/design/selected-all-companies.html', 'utf8');
    for (const token of ['#F3F6F7', '#FCFDFD', '#172126', '#245EB5']) expect(selected).toContain(token);
    expect(selected).toMatch(/loading|stale|empty/i);
  });
});
