import { Timestamp } from 'firebase/firestore'
import { describe, expect, it } from 'vitest'
import { diffFields } from './diff'

describe('diffFields', () => {
  it('records only changed fields on update', () => {
    expect(diffFields({ name: 'रीना', phone: '1', area: 'x' }, { name: 'रीना', phone: '2' })).toEqual({
      phone: { from: '1', to: '2' },
    })
  })

  it('records every non-empty field on create', () => {
    expect(diffFields(null, { name: 'सुनीता', notes: null, rate: 300 })).toEqual({
      name: { from: null, to: 'सुनीता' },
      rate: { from: null, to: 300 },
    })
  })

  it('ignores bookkeeping fields', () => {
    expect(diffFields({ version: 1 }, { version: 2, updatedBy: 'u', updatedAt: null })).toEqual({})
  })

  it('compares nested objects regardless of key order', () => {
    const before = { m: { bust: 34, waist: 30 }, tags: ['vip'] }
    expect(diffFields(before, { m: { waist: 30, bust: 34 }, tags: ['vip'] })).toEqual({})
    expect(diffFields(before, { tags: ['vip', 'regular'] })).toEqual({
      tags: { from: ['vip'], to: ['vip', 'regular'] },
    })
  })

  it('compares timestamps by value', () => {
    const a = Timestamp.fromMillis(1000)
    expect(diffFields({ d: a }, { d: Timestamp.fromMillis(1000) })).toEqual({})
    expect(Object.keys(diffFields({ d: a }, { d: Timestamp.fromMillis(2000) }))).toEqual(['d'])
  })

  it('treats undefined and null as the same', () => {
    expect(diffFields({ notes: null }, { notes: undefined })).toEqual({})
  })
})
