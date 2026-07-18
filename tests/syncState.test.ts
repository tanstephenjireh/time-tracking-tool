import test from 'node:test';
import assert from 'node:assert';
import { getSyncState, updateSyncState } from '../src/lib/syncState';

test('syncState', async (t) => {
  await t.test('initial state', () => {
    const state = getSyncState();
    assert.strictEqual(state.isSyncing, false);
    assert.strictEqual(state.eventsProcessed, 0);
  });

  await t.test('update state', () => {
    updateSyncState({ isSyncing: true, eventsProcessed: 10 });
    const state = getSyncState();
    assert.strictEqual(state.isSyncing, true);
    assert.strictEqual(state.eventsProcessed, 10);
  });
});
