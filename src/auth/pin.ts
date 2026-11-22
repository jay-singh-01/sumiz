/*
 * 4-digit app PIN: a quick re-entry lock on top of Google Sign-In, not the
 * real security boundary (that's Google auth + Firestore rules). A 4-digit
 * space can't resist offline brute force no matter how it's hashed; PBKDF2
 * just avoids storing it in the clear.
 */

export const PIN_LENGTH = 4
export const LOCK_AFTER_HIDDEN_MS = 5 * 60 * 1000
export const MAX_PIN_ATTEMPTS = 5
const ITERATIONS = 150_000

const toB64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes))
const fromB64 = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))

export function isValidPin(pin: string): boolean {
  return new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin)
}

async function derive(pin: string, salt: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations: ITERATIONS },
    key,
    256,
  )
  return toB64(new Uint8Array(bits))
}

export async function hashPin(pin: string): Promise<{ pinHash: string; pinSalt: string }> {
  if (!isValidPin(pin)) throw new Error('PIN must be 4 digits')
  const salt = crypto.getRandomValues(new Uint8Array(16))
  return { pinHash: await derive(pin, salt), pinSalt: toB64(salt) }
}

export async function verifyPin(pin: string, pinHash: string, pinSalt: string): Promise<boolean> {
  if (!isValidPin(pin)) return false
  const candidate = await derive(pin, fromB64(pinSalt))
  // Constant-time-ish compare; timing hardly matters for a local lock but costs nothing.
  if (candidate.length !== pinHash.length) return false
  let diff = 0
  for (let i = 0; i < candidate.length; i++) diff |= candidate.charCodeAt(i) ^ pinHash.charCodeAt(i)
  return diff === 0
}

/** Re-lock if the app was in the background for longer than the limit. */
export function shouldRelock(hiddenAt: number | null, now: number): boolean {
  return hiddenAt !== null && now - hiddenAt >= LOCK_AFTER_HIDDEN_MS
}
