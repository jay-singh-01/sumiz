import { describe, expect, it } from 'vitest'
import { customerSchema, EMPTY_CUSTOMER, normalizePhone } from '@/features/customers/schema'
import { formatPhone, telLink, whatsappLink } from './whatsapp'

describe('phone numbers', () => {
  it.each([
    ['+91 98290-12345', '9829012345'],
    ['09829012345', '9829012345'],
    ['919829012345', '9829012345'],
    ['98290 12345', '9829012345'],
  ])('normalizes %s', (raw, d) => {
    expect(normalizePhone(raw)).toBe(d)
  })

  it('builds WhatsApp links with an encoded Hindi message', () => {
    expect(whatsappLink('98290 12345', 'नमस्ते')).toBe('https://wa.me/919829012345?text=%E0%A4%A8%E0%A4%AE%E0%A4%B8%E0%A5%8D%E0%A4%A4%E0%A5%87')
    expect(whatsappLink('12345')).toBeNull()
  })

  it('formats for display and calling', () => {
    expect(formatPhone('9829012345')).toBe('98290 12345')
    expect(telLink('9829012345')).toBe('tel:+919829012345')
  })

  it('customer schema stores the normalized number and rejects bad ones', () => {
    expect(customerSchema.parse({ ...EMPTY_CUSTOMER, name: 'रीना', phone: '+91 98290 12345' }).phone).toBe('9829012345')
    expect(customerSchema.safeParse({ ...EMPTY_CUSTOMER, name: 'रीना', phone: '12345' }).success).toBe(false)
    expect(customerSchema.safeParse({ ...EMPTY_CUSTOMER, name: 'रीना', phone: '' }).success).toBe(true)
  })
})
