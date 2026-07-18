'use client';
import { useState, useEffect } from 'react';

export default function SyncSettingsPage() {
  const [status, setStatus] = useState<any>(null);
  const [triggering, setTriggering] = useState(false);

  const fetchStatus = () => {
    fetch('/api/sync/status')
      .then(r => r.json())
      .then(d => setStatus(d));
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleTrigger = async () => {
    setTriggering(true);
    await fetch('/api/sync/trigger', { method: 'POST' });
    fetchStatus();
    setTriggering(false);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Sync Settings</h1>
      
      <div className="bg-white p-8 rounded-lg shadow-sm border border-slate-200 space-y-6">
        <div className="flex items-center justify-between border-b pb-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Calendar Data Sync</h2>
            <p className="text-sm text-slate-500 mt-1">Ingest raw calendar events and process them with AI.</p>
          </div>
          <button 
            onClick={handleTrigger}
            disabled={status?.isSyncing || triggering}
            className="bg-[#FDE047] hover:bg-[#FACC15] text-[#0F172A] font-medium py-2 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {status?.isSyncing ? 'Sync in Progress...' : 'Run Manual Sync'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-1">
            <div className="text-sm text-slate-500 font-medium">Status</div>
            <div className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full ${status?.isSyncing ? 'bg-blue-500 animate-pulse' : 'bg-green-500'}`}></div>
              <span className="font-semibold">{status?.isSyncing ? 'Processing' : 'Idle'}</span>
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-sm text-slate-500 font-medium">Last Synced</div>
            <div className="font-medium text-slate-800">
              {status?.lastSyncedAt ? new Date(status.lastSyncedAt).toLocaleString() : 'Never'}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-sm text-slate-500 font-medium">Events Processed (Last run)</div>
            <div className="font-medium text-slate-800">
              {status?.eventsProcessed || 0} / {status?.eventsTotal || 0}
            </div>
          </div>
        </div>

        {status?.errors && status.errors.length > 0 && (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <h3 className="text-sm font-bold text-red-800 mb-2">Recent Errors</h3>
            <ul className="text-sm text-red-700 list-disc pl-5 space-y-1">
              {status.errors.map((err: string, i: number) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
