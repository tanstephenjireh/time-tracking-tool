import { NextResponse } from 'next/server';
import { getSyncState } from '@/lib/syncState';

import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const memState = getSyncState();
  
  if (!memState.isSyncing) {
    const setting = await prisma.syncSetting.findUnique({ where: { id: 'global' } });
    if (setting) {
      memState.lastSyncedAt = setting.lastSyncedAt ? setting.lastSyncedAt.toISOString() : null;
      memState.eventsProcessed = setting.eventsProcessed;
      memState.eventsTotal = setting.eventsTotal;
    }
  }
  
  return NextResponse.json(memState, { status: 200 });
}
