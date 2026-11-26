import { describe, expect, it } from 'vitest'
import { buildBackup, fromJson, parseBackup, planRestore, toJson } from './backup'

const ts = (ms: number) => ({ toMillis: () => ms })

describe('backup JSON', () => {
  it('round-trips timestamps and nested values', () => {
    const value = { name: 'रीना', at: ts(1000), items: [{ when: ts(2000), qty: 2 }], none: undefined }
    const json = toJson(value)
    expect(json).toEqual({ name: 'रीना', at: { __ts: 1000 }, items: [{ when: { __ts: 2000 }, qty: 2 }], none: null })
    expect(fromJson(json, (ms) => `T${ms}`)).toEqual({ name: 'रीना', at: 'T1000', items: [{ when: 'T2000', qty: 2 }], none: null })
  })

  it('never writes PIN hashes into a backup', () => {
    const b = buildBackup('s1', 'app', { users: [{ id: 'u1', name: 'सुमित्रा', pinHash: 'x', pinSalt: 'y' }] })
    expect(b.collections.users?.[0]).toEqual({ id: 'u1', name: 'सुमित्रा' })
  })

  it('parses its own output and rejects other files', () => {
    const b = buildBackup('s1', 'app', { customers: [{ id: 'c1', name: 'रीना' }] }, new Date(2026, 10, 26))
    expect(parseBackup(JSON.stringify(b)).collections.customers?.[0].name).toBe('रीना')
    expect(() => parseBackup('hello')).toThrow('not-json')
    expect(() => parseBackup('{"a":1}')).toThrow('not-backup')
  })
})

describe('planRestore (dry run)', () => {
  const backup = buildBackup('s1', 'nightly', {
    customers: [
      { id: 'gone', name: 'मिटा हुआ', version: 3 },
      { id: 'deletedNow', name: 'रीसायकल', version: 2 },
      { id: 'changed', name: 'पुराना नाम', version: 2 },
      { id: 'same', name: 'वही', version: 5 },
      { id: 'deletedInBackup', name: 'x', isDeleted: true },
    ],
    counters: [{ id: 'device-A', letter: 'A', seq: 10 }],
    users: [{ id: 'u1', name: 'u' }],
  })
  const current = {
    customers: [
      { id: 'deletedNow', name: 'रीसायकल', version: 3, isDeleted: true },
      { id: 'changed', name: 'नया नाम', version: 4 },
      { id: 'same', name: 'वही', version: 6 },
      { id: 'newer', name: 'बैकअप के बाद बना', version: 1 },
    ],
    counters: [{ id: 'device-A', letter: 'A', seq: 42 }],
  }

  it('"missing" mode only brings back what is gone or deleted', () => {
    const plan = planRestore(backup, current, 'missing')
    expect(plan.items.map((i) => [i.coll, i.id, i.action])).toEqual([
      ['customers', 'gone', 'create'],
      ['customers', 'deletedNow', 'undelete'],
    ])
    expect(plan.summary.customers).toEqual({ create: 1, undelete: 1, overwrite: 0, unchanged: 1, keptNewer: 1 })
  })

  it('"overwrite" mode also reverts changed records, but never counters', () => {
    const plan = planRestore(backup, current, 'overwrite')
    expect(plan.items.map((i) => i.id)).toEqual(['gone', 'deletedNow', 'changed'])
    expect(plan.summary.counters).toEqual({ create: 0, undelete: 0, overwrite: 0, unchanged: 0, keptNewer: 1 })
  })

  it('never restores users or the audit log, and never touches newer records', () => {
    const plan = planRestore(backup, current, 'overwrite')
    expect(plan.items.some((i) => i.coll === 'users' || i.id === 'newer')).toBe(false)
  })
})
