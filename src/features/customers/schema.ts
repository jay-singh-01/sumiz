import { z } from 'zod'

/** Strips spaces, dashes, +91 / 0 prefixes. "+91 98290-12345" → "9829012345". */
export function normalizePhone(raw: string): string {
  let d = raw.replace(/\D/g, '')
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2)
  else if (d.length === 11 && d.startsWith('0')) d = d.slice(1)
  return d
}

/** Indian mobile: 10 digits starting 6–9. */
export const isIndianMobile = (d: string) => /^[6-9]\d{9}$/.test(d)

const optionalPhone = z
  .string()
  .transform(normalizePhone)
  .refine((d) => d === '' || isIndianMobile(d), 'invalidPhone')

const isoDate = z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/)

export const CUSTOMER_TAGS = ['regular', 'vip', 'wedding'] as const

export const customerSchema = z.object({
  name: z.string().trim().min(1, 'required').max(80),
  phone: optionalPhone,
  altPhone: optionalPhone,
  area: z.string().trim().max(60),
  address: z.string().trim().max(300),
  tags: z.array(z.string().trim().min(1).max(30)).max(10),
  referredBy: z.string().trim().max(80),
  birthday: isoDate,
  anniversary: isoDate,
  notes: z.string().trim().max(1000),
  photoUrl: z.string().url().nullable(),
})
export type Customer = z.infer<typeof customerSchema>

export const EMPTY_CUSTOMER: Customer = {
  name: '',
  phone: '',
  altPhone: '',
  area: '',
  address: '',
  tags: [],
  referredBy: '',
  birthday: '',
  anniversary: '',
  notes: '',
  photoUrl: null,
}
