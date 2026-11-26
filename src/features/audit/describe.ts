/*
 * Audit entries → one plain sentence, e.g.
 *   "सुमित्रा ने 12/11 को रीना जी का बिल बदला: कुल ₹1,200 से ₹1,000"
 */
import type { AuditEntry, FieldChange, Language } from '@/data/types'
import { formatINR } from '@/lib/format'

const ENTITY: Record<string, [hi: string, en: string]> = {
  customers: ['ग्राहक', 'customer'],
  orders: ['ऑर्डर', 'order'],
  bills: ['बिल', 'bill'],
  payments: ['भुगतान', 'payment'],
  measurements: ['नाप', 'measurements'],
  garmentTypes: ['कपड़ा', 'garment'],
  addOns: ['एक्स्ट्रा काम', 'add-on'],
  settings: ['सेटिंग', 'settings'],
  users: ['उपयोगकर्ता', 'user'],
  reminders: ['रिमाइंडर', 'reminder'],
  counters: ['ऑर्डर नंबर', 'order numbering'],
  shops: ['दुकान', 'shop'],
  shop: ['दुकान', 'shop'],
  invites: ['न्योता', 'invite'],
  expenses: ['खर्च', 'expense'],
  karigars: ['कारीगर', 'karigar'],
  session: ['', ''],
}

const FIELD: Record<string, [string, string]> = {
  name: ['नाम', 'name'],
  phone: ['फ़ोन', 'phone'],
  area: ['मोहल्ला', 'area'],
  total: ['कुल', 'total'],
  amount: ['रकम', 'amount'],
  rate: ['दर', 'rate'],
  defaultRate: ['दर', 'rate'],
  status: ['स्थिति', 'status'],
  deliveryDate: ['देने की तारीख़', 'delivery date'],
  trialDate: ['ट्रायल', 'trial'],
  discount: ['छूट', 'discount'],
  lines: ['बिल की चीज़ें', 'bill items'],
  items: ['कपड़े', 'items'],
  active: ['चालू', 'active'],
  upiId: ['UPI', 'UPI'],
  shopName: ['दुकान का नाम', 'shop name'],
  role: ['भूमिका', 'role'],
  pinHash: ['PIN', 'PIN'],
  revokedBefore: ['सभी डिवाइस से लॉग आउट', 'signed out everywhere'],
  isDeleted: ['हटाया', 'deleted'],
  urgent: ['अर्जेंट', 'urgent'],
  mode: ['तरीका', 'mode'],
  templates: ['WhatsApp संदेश', 'WhatsApp messages'],
}

const MONEY = new Set(['total', 'amount', 'rate', 'defaultRate'])
const STATUS_HI: Record<string, string> = {
  received: 'मिला',
  cutting: 'कटिंग',
  stitching: 'सिलाई',
  trial: 'ट्रायल',
  ready: 'तैयार',
  delivered: 'दिया',
  cancelled: 'रद्द',
}

function shortDate(ms: number | null): string {
  if (ms === null) return '—'
  const d = new Date(ms)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

function show(field: string, v: unknown, lang: Language): string {
  if (v === null || v === undefined || v === '') return '—'
  if (MONEY.has(field) && typeof v === 'number') return formatINR(v)
  if (field === 'status' && typeof v === 'string' && lang === 'hi') return STATUS_HI[v] ?? v
  if (typeof v === 'boolean') return lang === 'hi' ? (v ? 'हाँ' : 'नहीं') : v ? 'yes' : 'no'
  if (typeof v === 'object') return '…'
  const s = String(v)
  return s.length > 30 ? `${s.slice(0, 30)}…` : s
}

/** The 1–2 most meaningful changes, as "कुल ₹1,200 से ₹1,000". */
export function describeChanges(changes: Record<string, FieldChange> | undefined, lang: Language, max = 2): string {
  if (!changes) return ''
  // The salt is part of the PIN; never list it separately.
  const keys = Object.keys(changes).filter((k) => k !== 'pinSalt')
  const ranked = [...keys.filter((k) => FIELD[k]), ...keys.filter((k) => !FIELD[k])].slice(0, max)
  const parts = ranked.map((k) => {
    const label = FIELD[k]?.[lang === 'hi' ? 0 : 1] ?? k
    const c = changes[k]
    if (c.from === null || c.from === undefined) return `${label}: ${show(k, c.to, lang)}`
    return lang === 'hi' ? `${label} ${show(k, c.from, lang)} से ${show(k, c.to, lang)}` : `${label} ${show(k, c.from, lang)} → ${show(k, c.to, lang)}`
  })
  const more = keys.length - ranked.length
  return parts.join(', ') + (more > 0 ? (lang === 'hi' ? ` (+${more} और)` : ` (+${more} more)`) : '')
}

export function describeAudit(e: Pick<AuditEntry, 'actorName' | 'action' | 'entityType' | 'entityLabel' | 'changes' | 'device' | 'note'> & { atMs: number | null }, lang: Language): string {
  const who = e.actorName
  const when = shortDate(e.atMs)
  const [typeHi, typeEn] = ENTITY[e.entityType] ?? [e.entityType, e.entityType]
  const label = e.entityLabel ? (lang === 'hi' ? `“${e.entityLabel}”` : `“${e.entityLabel}”`) : ''
  const changes = describeChanges(e.changes, lang)
  if (lang === 'hi') {
    const head = `${who} ने ${when} को`
    switch (e.action) {
      case 'create':
        return `${head} ${typeHi} बनाया ${label}`.trim()
      case 'update':
        return `${head} ${label} का ${typeHi} बदला${changes ? `: ${changes}` : ''}`.replace('  ', ' ')
      case 'delete':
        return `${head} ${typeHi} हटाया ${label} (रीसायकल बिन में)`.trim()
      case 'restore':
        return `${head} ${typeHi} वापस लाया ${label}`.trim()
      case 'login':
        return `${head} लॉगिन किया (${e.device})`
      case 'logout':
        return `${head} लॉग आउट किया (${e.device})`
      case 'signOutAll':
        return `${head} सभी डिवाइस से लॉग आउट किया`
      case 'backup':
        return `${head} बैकअप लिया${e.note ? ` (${e.note})` : ''}`
      case 'export':
        return `${head} रिपोर्ट निकाली${e.note ? ` (${e.note})` : ''}`
      case 'restoreBackup':
        if (e.entityType === 'shop') return `${head} बैकअप से ${e.note ?? ''} वापस लाए`.replace('  ', ' ')
        return `${head} बैकअप से ${typeHi} वापस लाया ${label}`.trim()
    }
  }
  const head = `${who} on ${when}`
  switch (e.action) {
    case 'create':
      return `${head} created ${typeEn} ${label}`.trim()
    case 'update':
      return `${head} changed ${typeEn} ${label}${changes ? `: ${changes}` : ''}`
    case 'delete':
      return `${head} deleted ${typeEn} ${label} (in Recycle Bin)`
    case 'restore':
      return `${head} restored ${typeEn} ${label}`
    case 'login':
      return `${head} signed in (${e.device})`
    case 'logout':
      return `${head} signed out (${e.device})`
    case 'signOutAll':
      return `${head} signed out of all devices`
    case 'backup':
      return `${head} took a backup${e.note ? ` (${e.note})` : ''}`
    case 'export':
      return `${head} exported a report${e.note ? ` (${e.note})` : ''}`
    case 'restoreBackup':
      if (e.entityType === 'shop') return `${head} restored ${e.note ?? 'records'} from a backup`
      return `${head} restored ${typeEn} ${label} from a backup`
  }
  return `${head} ${e.action}`
}
