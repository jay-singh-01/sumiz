import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth, GoogleAuthProvider } from 'firebase/auth'
import {
  CACHE_SIZE_UNLIMITED,
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore'
import { env } from './env'

export const app = initializeApp(env.firebase)

export const auth = getAuth(app)
export const googleProvider = new GoogleAuthProvider()
googleProvider.setCustomParameters({ prompt: 'select_account' })

// Offline-first: every write lands in IndexedDB immediately and syncs when
// online. The multi-tab manager keeps several open tabs on one shared cache.
// Unlimited cache size disables Firestore's LRU garbage collection: delta sync
// (src/data/sync.ts) relies on every synced document staying in the cache.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
    cacheSizeBytes: CACHE_SIZE_UNLIMITED,
  }),
  ignoreUndefinedProperties: true,
})

if (env.useEmulators) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
}
