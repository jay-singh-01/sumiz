import { describe, expect, it } from 'vitest'
import { describeAudit, describeChanges } from './describe'

const at = new Date(2026, 10, 12, 15, 0).getTime()

describe('describeAudit', () => {
  it('reads like the spec example for a bill edit', () => {
    expect(
      describeAudit(
        { actorName: 'सुमित्रा', action: 'update', entityType: 'bills', entityLabel: 'रीना जी', changes: { total: { from: 1200, to: 1000 } }, device: 'Android · Chrome', atMs: at },
        'hi',
      ),
    ).toBe('सुमित्रा ने 12/11 को “रीना जी” का बिल बदला: कुल ₹1,200 से ₹1,000')
  })

  it('describes creates, deletes, restores and logins', () => {
    const base = { actorName: 'सुमित्रा', entityLabel: 'सुनीता', device: 'Android · Chrome', atMs: at }
    expect(describeAudit({ ...base, action: 'create', entityType: 'customers' }, 'hi')).toBe('सुमित्रा ने 12/11 को ग्राहक बनाया “सुनीता”')
    expect(describeAudit({ ...base, action: 'delete', entityType: 'customers' }, 'hi')).toBe('सुमित्रा ने 12/11 को ग्राहक हटाया “सुनीता” (रीसायकल बिन में)')
    expect(describeAudit({ ...base, action: 'restore', entityType: 'customers' }, 'hi')).toBe('सुमित्रा ने 12/11 को ग्राहक वापस लाया “सुनीता”')
    expect(describeAudit({ ...base, action: 'login', entityType: 'session', entityLabel: undefined }, 'hi')).toBe('सुमित्रा ने 12/11 को लॉगिन किया (Android · Chrome)')
  })

  it('translates order statuses and has an English version', () => {
    const e = { actorName: 'Jay', action: 'update' as const, entityType: 'orders', entityLabel: 'GD/26-27/A001', changes: { status: { from: 'stitching', to: 'ready' } }, device: 'x', atMs: at }
    expect(describeAudit(e, 'hi')).toContain('स्थिति सिलाई से तैयार')
    expect(describeAudit(e, 'en')).toBe('Jay on 12/11 changed order “GD/26-27/A001”: status stitching → ready')
  })
})

describe('describeChanges', () => {
  it('shows at most two changes and counts the rest', () => {
    expect(describeChanges({ phone: { from: '1', to: '2' }, area: { from: 'a', to: 'b' }, notes: { from: 'x', to: 'y' } }, 'hi')).toBe('फ़ोन 1 से 2, मोहल्ला a से b (+1 और)')
  })
  it('never reveals the PIN and hides the salt', () => {
    expect(describeChanges({ pinHash: { from: null, to: '•••' }, pinSalt: { from: null, to: '•••' } }, 'hi')).toBe('PIN: •••')
  })

  it('summarises a whole restore', async () => {
    const { describeAudit } = await import('./describe')
    expect(describeAudit({ actorName: 'सुमित्रा', action: 'restoreBackup', entityType: 'shop', note: '12 रिकॉर्ड', device: 'x', atMs: at }, 'hi')).toBe('सुमित्रा ने 12/11 को बैकअप से 12 रिकॉर्ड वापस लाए')
  })
})
