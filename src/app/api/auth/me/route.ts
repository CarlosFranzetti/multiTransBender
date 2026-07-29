import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { isDatabaseConfigured } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    accountsEnabled: isDatabaseConfigured(),
    user: await currentUser(),
  });
}
