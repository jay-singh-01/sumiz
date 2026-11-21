import { defineConfig } from 'vitest/config'

// Firestore security-rules tests. Run via `npm run test:rules`,
// which starts the Firestore emulator around this suite.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/rules/**/*.test.ts'],
    testTimeout: 20000,
    fileParallelism: false,
  },
})
