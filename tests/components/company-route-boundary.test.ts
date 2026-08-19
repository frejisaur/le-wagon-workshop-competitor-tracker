import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';

describe('company route server boundary', () => {
  it('imports tab parsing from a server-safe module instead of the client component', () => {
    const route = readFileSync('app/companies/[companyId]/page.tsx', 'utf8');
    const parser = readFileSync('components/company/company-tab.ts', 'utf8');

    expect(route).toContain("import {CompanyWorkspace} from '@/components/company/CompanyWorkspace'");
    expect(route).toContain("import {parseCompanyTab} from '@/components/company/company-tab'");
    expect(route).not.toMatch(/CompanyWorkspace[^;\n]*parseCompanyTab|parseCompanyTab[^;\n]*CompanyWorkspace/);
    expect(parser.trimStart()).not.toMatch(/^['\"]use client['\"]/);
  });
});
