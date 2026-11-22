export type SyncState = 'saved' | 'syncing' | 'offline'

/** What the sync badge shows. Offline wins: the data is safe on the phone either way. */
export function deriveSyncState(online: boolean, pending: number, flushing: boolean): SyncState {
  if (!online) return 'offline'
  if (pending > 0 || flushing) return 'syncing'
  return 'saved'
}
