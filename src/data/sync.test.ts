import { Timestamp } from 'firebase/firestore'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/firebase', () => ({ db: {} }))
const { newestUpdate, retryDelay } = await import('./sync')

describe('newestUpdate', () => {
  it('advances to the newest server timestamp', () => {
    const docs = [{ updatedAt: Timestamp.fromMillis(500) }, { updatedAt: Timestamp.fromMillis(900) }]
    expect(newestUpdate(docs, 100)).toBe(900)
  })

  it('ignores pending local writes that have no server time yet', () => {
    expect(newestUpdate([{ updatedAt: null }, {}], 100)).toBe(100)
  })

  it('never moves backwards', () => {
    expect(newestUpdate([{ updatedAt: Timestamp.fromMillis(50) }], 100)).toBe(100)
  })
})

describe('retryDelay', () => {
  it('backs off exponentially and caps at a minute', () => {
    expect([0, 1, 2, 3].map(retryDelay)).toEqual([1000, 2000, 4000, 8000])
    expect(retryDelay(20)).toBe(60_000)
  })
})
