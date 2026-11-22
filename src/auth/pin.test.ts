// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { hashPin, isValidPin, LOCK_AFTER_HIDDEN_MS, shouldRelock, verifyPin } from './pin'

describe('PIN', () => {
  it('accepts exactly four digits', () => {
    expect(isValidPin('1234')).toBe(true)
    expect(isValidPin('123')).toBe(false)
    expect(isValidPin('12345')).toBe(false)
    expect(isValidPin('12a4')).toBe(false)
    expect(isValidPin('१२३४')).toBe(false)
  })

  it('verifies the right PIN and rejects others', async () => {
    const { pinHash, pinSalt } = await hashPin('2580')
    expect(await verifyPin('2580', pinHash, pinSalt)).toBe(true)
    expect(await verifyPin('2581', pinHash, pinSalt)).toBe(false)
    expect(await verifyPin('', pinHash, pinSalt)).toBe(false)
  })

  it('salts each hash', async () => {
    const a = await hashPin('1111')
    const b = await hashPin('1111')
    expect(a.pinHash).not.toBe(b.pinHash)
    expect(a.pinSalt).not.toBe(b.pinSalt)
  })

  it('refuses to hash an invalid PIN', async () => {
    await expect(hashPin('12')).rejects.toThrow()
  })
})

describe('shouldRelock', () => {
  it('relocks only after 5 minutes in the background', () => {
    expect(shouldRelock(null, 10 ** 9)).toBe(false)
    expect(shouldRelock(0, LOCK_AFTER_HIDDEN_MS - 1)).toBe(false)
    expect(shouldRelock(0, LOCK_AFTER_HIDDEN_MS)).toBe(true)
  })
})
