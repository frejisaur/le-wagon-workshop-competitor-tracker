import {NextResponse} from 'next/server';
import {getDashboardCache} from '@/lib/api/dashboard-service';
import {CACHE_INVALIDATION_MAX_BODY_BYTES, verifyCacheInvalidation} from '@/lib/cache/signature';
import {getCacheInvalidationEnv} from '@/lib/config/server-env';

export const runtime = 'nodejs';
function bad(status: number): NextResponse { return NextResponse.json({error: 'cache_invalidation_rejected'}, {status}); }

export async function POST(request: Request): Promise<NextResponse> {
  const declaredSize = request.headers.get('content-length');
  if (declaredSize && (!/^\d+$/.test(declaredSize) || Number(declaredSize) > CACHE_INVALIDATION_MAX_BODY_BYTES)) return bad(400);
  if (!request.headers.get('x-cache-timestamp') || !request.headers.get('x-cache-signature')) return bad(401);
  const body = new Uint8Array(await request.arrayBuffer());
  let secret: string | undefined;
  try { secret = getCacheInvalidationEnv().CACHE_INVALIDATION_SECRET; } catch { return bad(503); }
  const result = verifyCacheInvalidation({headers: request.headers, body, secret});
  if (!result.ok) return bad(result.code === 'unauthorized' ? 401 : 400);
  getDashboardCache().invalidate();
  return NextResponse.json({status: 'invalidated'});
}
