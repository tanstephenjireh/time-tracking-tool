import { NextResponse } from 'next/server';
import { runSyncTask } from '@/lib/syncTask';

export async function POST() {
  // Start the sync process asynchronously without awaiting
  runSyncTask().catch(err => {
    console.error('Unhandled error in background sync task', err);
  });
  
  return NextResponse.json({
    status: 'started',
    message: 'Sync pipeline triggered successfully.'
  }, { status: 202 });
}
