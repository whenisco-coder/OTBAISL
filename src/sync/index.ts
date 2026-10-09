/**
 * Layer 4: Sync (Future: multi-device sync and Tally sync queue)
 * Currently stubbed per architectural design.
 */

export interface SyncEngine {
  pushLocalChanges(): Promise<{ synced: number }>;
  pullRemoteChanges(): Promise<{ pulled: number }>;
  getPendingSyncCount(): Promise<number>;
}

export const syncEngineStub: SyncEngine = {
  async pushLocalChanges() {
    // TODO Phase 3: Implement peer-to-peer or server sync queue
    return { synced: 0 };
  },
  async pullRemoteChanges() {
    // TODO Phase 3: Implement delta pull
    return { pulled: 0 };
  },
  async getPendingSyncCount() {
    return 0;
  },
};
