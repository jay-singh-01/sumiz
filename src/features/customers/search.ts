/*
 * Transliteration-aware customer search: "sunita", "suneeta" and "सुनीता"
 * all find each other; "982" finds a phone number.
 *
 * How: Devanagari is romanised (with word-final schwa deletion), then both
 * sides are reduced to a phonetic key: aspirates folded (sh→s, kh→k…),
 * long vowels shortened (ee→i, aa→a), and every non-initial "a" dropped so
 * the medial schwa ("सरला" → sarala vs "sarla") stops mattering.
 */

const VOWELS: Record<string, string> = {
  अ: 'a', आ: 'aa', इ: 'i', ई: 'ii', उ: 'u', ऊ: 'uu', ऋ: 'ri', ए: 'e', ऐ: 'ai', ओ: 'o', औ: 'au', ऑ: 'o', ऍ: 'e',
}
const MATRAS: Record<string, string> = {
  'ा': 'aa', 'ि': 'i', 'ी': 'ii', 'ु': 'u', 'ू': 'uu', 'ृ': 'ri', 'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au', 'ॉ': 'o', 'ॅ': 'e',
}
const CONSONANTS: Record<string, string> = {
  क: 'k', ख: 'kh', ग: 'g', घ: 'gh', ङ: 'n', च: 'ch', छ: 'chh', ज: 'j', झ: 'jh', ञ: 'n',
  ट: 't', ठ: 'th', ड: 'd', ढ: 'dh', ण: 'n', त: 't', थ: 'th', द: 'd', ध: 'dh', न: 'n',
  प: 'p', फ: 'ph', ब: 'b', भ: 'bh', म: 'm', य: 'y', र: 'r', ल: 'l', व: 'v', श: 'sh', ष: 'sh',
  स: 's', ह: 'h', ळ: 'l',
  // precomposed nukta letters
  'क़': 'k', 'ख़': 'kh', 'ग़': 'g', 'ज़': 'z', 'ड़': 'r', 'ढ़': 'rh', 'फ़': 'f', 'य़': 'y',
}
const NUKTA_FORMS: Record<string, string> = { k: 'k', kh: 'kh', g: 'g', j: 'z', d: 'r', dh: 'rh', ph: 'f', y: 'y' }
const HALANT = '्'
const NUKTA = '़'
const NASALS = new Set(['ं', 'ँ'])
const VISARGA = 'ः'
const DIGITS = '०१२३४५६७८९'

/** Devanagari → Latin. Non-Devanagari characters pass through unchanged. */
export function romanize(input: string): string {
  const chars = [...input.normalize('NFC')]
  let out = ''
  let pendingA = false // inherent vowel after the last consonant

  const flushA = (wordEnds: boolean) => {
    if (pendingA && !wordEnds) out += 'a'
    pendingA = false
  }

  for (let i = 0; i < chars.length; i++) {
    const c = chars[i]
    const next = chars[i + 1]
    if (c in CONSONANTS) {
      flushA(false)
      let latin = CONSONANTS[c]
      if (next === NUKTA) {
        latin = NUKTA_FORMS[latin] ?? latin
        i++
      }
      out += latin
      pendingA = true
    } else if (c in MATRAS) {
      pendingA = false
      out += MATRAS[c]
    } else if (c === HALANT) {
      pendingA = false
    } else if (NASALS.has(c)) {
      flushA(false)
      out += 'n'
    } else if (c === VISARGA) {
      flushA(false)
      out += 'h'
    } else if (c in VOWELS) {
      flushA(false)
      out += VOWELS[c]
    } else if (DIGITS.includes(c)) {
      flushA(true)
      out += String(DIGITS.indexOf(c))
    } else {
      // Space, punctuation, Latin: a word boundary drops the final schwa ("कमल" → kamal).
      flushA(true)
      out += c
    }
  }
  flushA(true)
  return out
}

/** Phonetic key used for fuzzy matching. */
export function phoneticKey(input: string): string {
  let s = romanize(input).toLowerCase()
  s = s
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/x/g, 'ks')
    .replace(/q/g, 'k')
    .replace(/z/g, 'j')
    .replace(/w/g, 'v')
    .replace(/ph/g, 'f')
    .replace(/ck/g, 'k')
    .replace(/([bcdgjklmnprstvy])h/g, '$1') // sh→s, kh→k, chh→ch→c…
    .replace(/ee|ii|ie/g, 'i')
    .replace(/oo|uu/g, 'u')
  // Drop "a" except at the start of each word (schwa / long-a insensitivity).
  s = s
    .split(' ')
    .map((w) => (w ? w[0] + w.slice(1).replace(/a/g, '') : w))
    .join(' ')
  return s.replace(/(.)\1+/g, '$1') // collapse doubles: anni → ani
}

export interface Searchable {
  name: string
  phone?: string
  altPhone?: string
  area?: string
}

/** 0 = best. null = no match. */
export function matchScore(item: Searchable, query: string): number | null {
  const q = query.trim()
  if (!q) return 0
  const digits = q.replace(/\D/g, '')
  if (digits.length >= 3 && digits.length === q.replace(/\s/g, '').length) {
    return `${item.phone ?? ''} ${item.altPhone ?? ''}`.includes(digits) ? 1 : null
  }
  const name = item.name.toLowerCase()
  const ql = q.toLowerCase()
  if (name.startsWith(ql)) return 0
  const nk = phoneticKey(item.name)
  const qk = phoneticKey(q)
  if (qk && nk.split(' ').some((w) => w.startsWith(qk))) return 1
  if (name.includes(ql)) return 2
  if (qk.length >= 2 && nk.includes(qk)) return 3
  const area = (item.area ?? '').toLowerCase()
  if (area && (area.includes(ql) || (qk.length >= 2 && phoneticKey(area).includes(qk)))) return 4
  return null
}

/** Filters and ranks; stable within a score so the caller's order (e.g. recent first) is kept. */
export function searchCustomers<T extends Searchable>(items: T[], query: string): T[] {
  if (!query.trim()) return items
  return items
    .map((item, i) => ({ item, i, score: matchScore(item, query) }))
    .filter((r): r is { item: T; i: number; score: number } => r.score !== null)
    .sort((a, b) => a.score - b.score || a.i - b.i)
    .map((r) => r.item)
}
