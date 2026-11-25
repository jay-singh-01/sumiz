import { financialYear } from '@/lib/format'

/*
 * Order numbers: <prefix>/<FY>/<device letter><sequence>, e.g. GD/26-27/A042.
 *
 * Each device claims a letter once (online, at first sign-in) and then numbers
 * its own orders, offline or not. Two devices can never hand out the same
 * number, and nobody waits for the network to take an order. Sequences
 * restart on 1 April.
 */

// I and O are skipped: too easy to confuse with 1 and 0 when read aloud.
export const DEVICE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'.split('')

/** First free letter; two-letter codes (AA, AB…) after the 24 singles are used. */
export function pickFreeLetter(taken: Iterable<string>): string {
  const used = new Set(taken)
  for (const l of DEVICE_LETTERS) if (!used.has(l)) return l
  for (const a of DEVICE_LETTERS) for (const b of DEVICE_LETTERS) if (!used.has(a + b)) return a + b
  throw new Error('No device letters left')
}

export function formatOrderNumber(prefix: string, fy: string, letter: string, seq: number): string {
  return `${prefix}/${fy}/${letter}${String(seq).padStart(3, '0')}`
}

/** The next sequence for a counter on a given date, restarting in a new financial year. */
export function nextSequence(counter: { fy: string; seq: number }, date: Date): { fy: string; seq: number } {
  const fy = financialYear(date)
  return counter.fy === fy ? { fy, seq: counter.seq + 1 } : { fy, seq: 1 }
}
