import {NextResponse} from 'next/server';
import {getCompanyResponse} from '@/lib/api/dashboard-service';

export const runtime = 'nodejs';
const COMPANY_ID = /^[a-z0-9][a-z0-9-]{0,127}$/;
export async function GET(_request: Request, context: {params: Promise<{companyId: string}>}): Promise<NextResponse> {
  const {companyId} = await context.params;
  if (!COMPANY_ID.test(companyId)) return NextResponse.json({error: 'not_found'}, {status: 404});
  const company = await getCompanyResponse(companyId);
  return company ? NextResponse.json(company) : NextResponse.json({error: 'not_found'}, {status: 404});
}
