import {NextResponse} from 'next/server';
import {getLandscapeResponse} from '@/lib/api/dashboard-service';

export const runtime = 'nodejs';
/** Non-secret process health; data freshness is intentionally separate from availability. */
export async function GET(): Promise<NextResponse> {
  const dashboard = await getLandscapeResponse();
  const healthy = dashboard.status !== 'failed';
  return NextResponse.json({status: healthy ? 'ok' : 'degraded', dependencies: {airtable: dashboard.status === 'loading' ? 'loading' : dashboard.status === 'failed' ? 'unavailable' : 'available'}, data: {status: dashboard.status, freshness: dashboard.freshness}}, {status: healthy ? 200 : 503});
}
