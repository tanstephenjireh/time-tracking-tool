import { NextResponse } from 'next/server';
import { runSyncTask } from '@/lib/syncTask';

export async function POST(req: Request) {
  let body: any = {};
  try {
    body = await req.json();
  } catch (e) {
    // Ignore empty body
  }
  const { timeMin, timeMax } = body;

  // Start the sync process asynchronously without awaiting
  runSyncTask({ timeMin, timeMax }).catch(err => {
    console.error('Unhandled error in background sync task', err);
  });
  
  return NextResponse.json({
    status: 'started',
    message: 'Sync pipeline triggered successfully.'
  }, { status: 202 });
}
