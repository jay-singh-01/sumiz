import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Firestore security-rules tests, plus integration tests of the app's write
// helpers against the emulator. Run via `npm run test:rules`, which starts the
// Firestore emulator around this suite.
export default defineConfig({
  // Pin the root: on Windows, `firebase emulators:exec` can hand us a cwd with
  // a different drive-letter case, which makes Vitest load itself twice.
  root: fileURLToPath(new URL('.', import.meta.url)),
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['tests/rules/**/*.test.ts'],
    setupFiles: ['fake-indexeddb/auto'],
    testTimeout: 20000,
    fileParallelism: false,
  },
})
