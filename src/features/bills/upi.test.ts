import { describe, expect, it } from 'vitest'
import { upiLink } from './upi'

describe('upiLink', () => {
  it('builds an NPCI pay link with amount in rupees and paise', () => {
    expect(upiLink({ vpa: 'sumitra@okaxis', payee: 'गोटा & धागा', amount: 1400, note: 'GD/26-27/A001' })).toBe(
      'upi://pay?pa=sumitra%40okaxis&pn=%E0%A4%97%E0%A5%8B%E0%A4%9F%E0%A4%BE%20%26%20%E0%A4%A7%E0%A4%BE%E0%A4%97%E0%A4%BE&cu=INR&am=1400.00&tn=GD%2F26-27%2FA001',
    )
  })

  it('omits the amount when nothing is due', () => {
    expect(upiLink({ vpa: 'a@b', payee: 'Shop', amount: 0 })).toBe('upi://pay?pa=a%40b&pn=Shop&cu=INR')
  })

  it('uses %20 for spaces, not +', () => {
    expect(upiLink({ vpa: 'a@b', payee: 'Gota Dhaaga' })).toContain('pn=Gota%20Dhaaga')
  })
})
