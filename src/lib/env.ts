import { z } from 'zod'

const envSchema = z.object({
  VITE_FIREBASE_API_KEY: z.string().min(1),
  VITE_FIREBASE_AUTH_DOMAIN: z.string().min(1),
  VITE_FIREBASE_PROJECT_ID: z.string().min(1),
  VITE_FIREBASE_APP_ID: z.string().min(1),
  VITE_FIREBASE_MESSAGING_SENDER_ID: z.string().optional(),
  VITE_USE_EMULATORS: z.enum(['true', 'false']).default('false'),
})

const parsed = envSchema.safeParse(import.meta.env)

if (!parsed.success) {
  // Fail loudly at startup rather than silently writing to the wrong place.
  throw new Error(
    'Missing Firebase config. Copy .env.example to .env.local and fill it in ' +
      '(see docs/FIREBASE_SETUP.md), or run `npm run dev:emu` for local emulators.\n' +
      z.prettifyError(parsed.error),
  )
}

export const env = {
  firebase: {
    apiKey: parsed.data.VITE_FIREBASE_API_KEY,
    authDomain: parsed.data.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: parsed.data.VITE_FIREBASE_PROJECT_ID,
    appId: parsed.data.VITE_FIREBASE_APP_ID,
    messagingSenderId: parsed.data.VITE_FIREBASE_MESSAGING_SENDER_ID,
  },
  useEmulators: parsed.data.VITE_USE_EMULATORS === 'true',
}
