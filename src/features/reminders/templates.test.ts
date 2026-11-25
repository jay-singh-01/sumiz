import { describe, expect, it } from 'vitest'
import { buildMessage, DEFAULT_TEMPLATES, templatesSchema } from './templates'

describe('reminder messages', () => {
  it('fills the payment reminder', () => {
    expect(buildMessage(DEFAULT_TEMPLATES.paymentDue, { name: 'रीना', amount: '850', upi: 'sumitra@okaxis', shop: 'गोटा & धागा' })).toBe(
      'नमस्ते रीना जी 🙏 आपका ₹850 बकाया है। कृपया सुविधानुसार भुगतान करें। UPI: sumitra@okaxis — गोटा & धागा',
    )
  })

  it('drops the UPI part when the shop has none', () => {
    const msg = buildMessage(DEFAULT_TEMPLATES.paymentDue, { name: 'रीना', amount: '850', shop: 'गोटा & धागा' })
    expect(msg).not.toContain('UPI')
    expect(msg).toBe('नमस्ते रीना जी 🙏 आपका ₹850 बकाया है। कृपया सुविधानुसार भुगतान करें। — गोटा & धागा')
  })

  it('drops "बाकी: ₹" from the ready message when nothing is due', () => {
    const msg = buildMessage(DEFAULT_TEMPLATES.ready, { name: 'सुनीता', num: 'GD/26-27/A007', amount: '0', shop: 'गोटा & धागा' })
    expect(msg).toBe('नमस्ते सुनीता जी 🙏 आपके कपड़े तैयार हैं (ऑर्डर GD/26-27/A007)। जब सुविधा हो, ले जाएँ। — गोटा & धागा')
  })

  it('fills the trial reminder with date and order', () => {
    expect(buildMessage(DEFAULT_TEMPLATES.trial, { name: 'पूजा', num: 'GD/26-27/B003', date: '27/11/2026', shop: 'S' })).toContain('27/11/2026 को आपका ट्रायल है (ऑर्डर GD/26-27/B003)')
  })

  it('defaults pass validation', () => {
    expect(templatesSchema.safeParse(DEFAULT_TEMPLATES).success).toBe(true)
  })
})
