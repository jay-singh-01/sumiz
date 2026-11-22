import { describe, expect, it } from 'vitest'
import { format } from './format'
import { strings } from './strings'

describe('i18n', () => {
  it('fills placeholders', () => {
    expect(format('नमस्ते, {name} जी', { name: 'सुमित्रा' })).toBe('नमस्ते, सुमित्रा जी')
    expect(format('{n} left', {})).toBe('{n} left')
  })

  it('has the same placeholders in Hindi and English', () => {
    const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()
    for (const key of Object.keys(strings.hi) as (keyof typeof strings.hi)[]) {
      expect(vars(strings.en[key]), key).toEqual(vars(strings.hi[key]))
    }
  })
})
