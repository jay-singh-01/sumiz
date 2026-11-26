import type { Timestamp } from 'firebase/firestore'
import { z } from 'zod'
import { templatesSchema } from '@/features/reminders/templates'

// Data schemas exclude Meta fields: the write helper adds those. Unknown keys
// (including Meta from a stored doc) are stripped by Zod on parse.

const name = z.string().trim().min(1).max(80)

export const roleSchema = z.enum(['owner', 'admin', 'helper'])
export const languageSchema = z.enum(['hi', 'en'])

export const shopSchema = z.object({
  name,
  ownerUid: z.string().min(1),
})
export type Shop = z.infer<typeof shopSchema>

export const userSchema = z.object({
  name,
  email: z.string().nullable(),
  role: roleSchema,
  language: languageSchema,
  pinHash: z.string().optional(),
  pinSalt: z.string().optional(),
  revokedBefore: z.custom<Timestamp>().optional(),
})
export type ShopUser = z.infer<typeof userSchema>

export const inviteSchema = z.object({
  shopId: z.string().min(1),
  role: z.enum(['admin', 'helper']),
  invitedName: z.string().trim().max(80).optional(),
})
export type Invite = z.infer<typeof inviteSchema>

/** UPI VPA, e.g. sumitra@okaxis. */
export const upiIdSchema = z.string().trim().regex(/^[\w.-]{2,256}@[a-zA-Z][a-zA-Z0-9]{1,63}$/, 'invalid UPI ID')

export const settingsSchema = z.object({
  shopName: name,
  subLine: z.string().trim().max(120),
  tagline: z.string().trim().max(120),
  logoUrl: z.string().url().nullable(),
  address: z.string().trim().max(300),
  phone: z.string().trim().max(20),
  upiId: upiIdSchema.or(z.literal('')),
  billFooter: z.string().trim().max(300),
  orderPrefix: z.string().trim().min(1).max(6),
  language: languageSchema,
  /** WhatsApp reminder templates; defaults apply until she edits them. */
  templates: templatesSchema.optional(),
  /** Extra features she can switch off (missing = on). */
  features: z.record(z.string(), z.boolean()).optional(),
  /** Optional GST on bills (off unless enabled). */
  gst: z.object({ enabled: z.boolean(), gstin: z.string().trim().max(15), rate: z.number().min(0).max(28) }).optional(),
  /** Free Cloudinary account for photos (unsigned upload preset). */
  cloudinary: z.object({ cloudName: z.string().trim().max(60), uploadPreset: z.string().trim().max(60) }).optional(),
})
export type Settings = z.infer<typeof settingsSchema>

export const DEFAULT_SETTINGS: Settings = {
  shopName: 'गोटा & धागा',
  subLine: 'by Sumitra · राजस्थानी सिलाई',
  tagline: 'हर टांके में अपनापन',
  logoUrl: null,
  address: '',
  phone: '',
  upiId: '',
  billFooter: 'आपका धन्यवाद, फिर पधारें 🙏',
  orderPrefix: 'GD',
  language: 'hi',
}
