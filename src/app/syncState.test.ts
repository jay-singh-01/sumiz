import { describe, expect, it } from 'vitest'
import { deriveSyncState } from './syncState'

describe('deriveSyncState', () => {
  it('shows offline first: data is safe on the phone', () => {
    expect(deriveSyncState(false, 3, true)).toBe('offline')
  })
  it('shows syncing while writes are in flight', () => {
    expect(deriveSyncState(true, 2, false)).toBe('syncing')
    expect(deriveSyncState(true, 0, true)).toBe('syncing')
  })
  it('shows all saved when nothing is pending', () => {
    expect(deriveSyncState(true, 0, false)).toBe('saved')
  })
})
