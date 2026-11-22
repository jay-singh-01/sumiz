import { describe, expect, it } from 'vitest'
import { addOnSchema, fieldKey, garmentTypeSchema } from './schema'
import { SEED_ADDONS, SEED_GARMENTS } from './seedData'

describe('fieldKey', () => {
  it('camelCases the English label', () => {
    expect(fieldKey('Front neck depth', [])).toBe('frontNeckDepth')
  })
  it('stays unique', () => {
    expect(fieldKey('Waist', ['waist', 'waist2'])).toBe('waist3')
  })
  it('falls back for Hindi-only or numeric labels', () => {
    expect(fieldKey('कंधा', [])).toBe('field')
    expect(fieldKey('2nd length', [])).toBe('f2ndLength')
  })
})

describe('seed master data', () => {
  it('every garment is valid and ids are unique', () => {
    const ids = new Set<string>()
    SEED_GARMENTS.forEach(([id, nameHi, nameEn, category, defaultRate, defaultDeliveryDays, icon, measurementFields], i) => {
      expect(ids.has(id), id).toBe(false)
      ids.add(id)
      expect(() => garmentTypeSchema.parse({ nameHi, nameEn, category, defaultRate, defaultDeliveryDays, icon, measurementFields, active: true, sortOrder: i })).not.toThrow()
      expect(new Set(measurementFields.map((f) => f.key)).size, `${id} duplicate field keys`).toBe(measurementFields.length)
    })
  })

  it('covers the Rajasthani essentials', () => {
    const names = SEED_GARMENTS.map((g) => g[1]).join(' ')
    for (const n of ['पोशाक', 'लहंगा', 'ब्लाउज़', 'कुर्ती', 'अनारकली', 'फ़ॉल-पीको', 'ऑल्टर']) expect(names).toContain(n)
    const addOns = SEED_ADDONS.map((a) => a[1]).join(' ')
    for (const n of ['गोटा-पत्ती', 'आरी', 'ज़री', 'शीशा', 'लटकन', 'अस्तर']) expect(addOns).toContain(n)
  })

  it('every add-on is valid', () => {
    SEED_ADDONS.forEach(([, nameHi, nameEn, defaultRate], i) => {
      expect(() => addOnSchema.parse({ nameHi, nameEn, defaultRate, active: true, sortOrder: i })).not.toThrow()
    })
  })

  it('blouse template matches the spec', () => {
    const blouse = SEED_GARMENTS.find((g) => g[0] === 'blouse-simple')![7].map((f) => f.key)
    expect(blouse).toEqual(['shoulder', 'bust', 'waist', 'frontLength', 'backLength', 'sleeveLength', 'sleeveRound', 'armhole', 'frontNeck', 'backNeck'])
  })
})
