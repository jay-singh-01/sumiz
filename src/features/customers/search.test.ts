import { describe, expect, it } from 'vitest'
import { matchScore, phoneticKey, romanize, searchCustomers } from './search'

describe('romanize', () => {
  it.each([
    ['सुनीता', 'suniitaa'],
    ['कमल', 'kamal'],
    ['सुमित्रा', 'sumitraa'],
    ['लक्ष्मी', 'lakshmii'],
    ['शांति', 'shaanti'],
    ['ज़रीना', 'zariinaa'],
    ['पूजा शर्मा', 'puujaa sharmaa'],
    ['फ़ातिमा', 'faatimaa'],
    ['गोटा & धागा', 'gotaa & dhaagaa'],
  ])('%s → %s', (hi, latin) => {
    expect(romanize(hi)).toBe(latin)
  })

  it('passes Latin through', () => {
    expect(romanize('Reena 98290')).toBe('Reena 98290')
  })
})

describe('phonetic matching across scripts and spellings', () => {
  it.each([
    ['sunita', 'सुनीता'],
    ['suneeta', 'सुनीता'],
    ['reena', 'रीना'],
    ['rina', 'रीना'],
    ['pooja', 'पूजा'],
    ['puja', 'पूजा'],
    ['sarla', 'सरला'],
    ['kamla', 'कमला'],
    ['laxmi', 'लक्ष्मी'],
    ['lakshmi', 'लक्ष्मी'],
    ['shanti', 'शांति'],
    ['geeta', 'गीता'],
    ['priya', 'प्रिया'],
    ['sumitra', 'सुमित्रा'],
    ['zarina', 'ज़रीना'],
    ['vandana', 'वंदना'],
    ['mohini', 'मोहिनी'],
  ])('%s ≈ %s', (latin, hi) => {
    expect(phoneticKey(latin)).toBe(phoneticKey(hi))
  })

  it('does not merge clearly different names', () => {
    expect(phoneticKey('sunita')).not.toBe(phoneticKey('सीमा'))
    expect(phoneticKey('reena')).not.toBe(phoneticKey('मीना'))
  })
})

describe('searchCustomers', () => {
  const people = [
    { name: 'सुनीता शर्मा', phone: '9829012345', area: 'शास्त्री नगर' },
    { name: 'Reena Jain', phone: '9414098765', area: 'Raja Park' },
    { name: 'सीमा', phone: '9001122334', area: 'मालवीय नगर' },
    { name: 'Sunil Kumar', phone: '7023456789', area: '' },
  ]
  const names = (q: string) => searchCustomers(people, q).map((p) => p.name)

  it('finds Hindi names from English typing', () => {
    expect(names('sunita')).toEqual(['सुनीता शर्मा'])
    expect(names('sharma')).toEqual(['सुनीता शर्मा'])
  })

  it('finds English names from Hindi typing', () => {
    expect(names('रीना')).toEqual(['Reena Jain'])
  })

  it('finds by partial phone number', () => {
    expect(names('98290')).toEqual(['सुनीता शर्मा'])
    expect(names('456')).toEqual(['Sunil Kumar'])
  })

  it('finds by area', () => {
    expect(names('raja park')).toEqual(['Reena Jain'])
    expect(names('malviya')).toEqual(['सीमा'])
  })

  it('ranks prefix matches first', () => {
    // "Sunil" literally starts with "sun"; "सुनीता" matches phonetically.
    expect(names('sun')).toEqual(['Sunil Kumar', 'सुनीता शर्मा'])
  })

  it('returns everything for an empty query', () => {
    expect(searchCustomers(people, '  ')).toHaveLength(4)
  })

  it('scores no match as null', () => {
    expect(matchScore(people[0], 'xyzq')).toBeNull()
  })
})
