import {NextResponse} from 'next/server';
import {getLandscapeResponse} from '@/lib/api/dashboard-service';

export const runtime = 'nodejs';
export async function GET(): Promise<NextResponse> { return NextResponse.json(await getLandscapeResponse()); }
