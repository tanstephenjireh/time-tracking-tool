import { NextResponse } from 'next/server';
import { getSyncState } from '@/lib/syncState';

export async function GET() {
  return NextResponse.json(getSyncState(), { status: 200 });
}
