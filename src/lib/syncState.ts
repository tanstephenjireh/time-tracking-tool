type SyncState = {
  isSyncing: boolean;
  lastSyncedAt: string | null;
  eventsProcessed: number;
  eventsTotal: number;
  errors: string[];
};

let state: SyncState = {
  isSyncing: false,
  lastSyncedAt: null,
  eventsProcessed: 0,
  eventsTotal: 0,
  errors: []
};

export function getSyncState() {
  return { ...state };
}

export function updateSyncState(updater: Partial<SyncState>) {
  state = { ...state, ...updater };
}
