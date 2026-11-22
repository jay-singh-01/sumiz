import { z } from 'zod'

export const garmentCategorySchema = z.enum(['women', 'men', 'kids', 'alteration', 'other'])
export type GarmentCategory = z.infer<typeof garmentCategorySchema>

export const measurementFieldSchema = z.object({
  key: z.string().regex(/^[a-zA-Z][a-zA-Z0-9]*$/),
  labelHi: z.string().trim().min(1).max(40),
  labelEn: z.string().trim().min(1).max(40),
  unit: z.enum(['inch', 'count', 'text']),
})
export type MeasurementField = z.infer<typeof measurementFieldSchema>

/** Stable camelCase key from a field's English label, unique within its template. */
export function fieldKey(labelEn: string, taken: string[]): string {
  const words = labelEn.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').trim().split(/\s+/).filter(Boolean)
  let base = words.map((w, i) => (i === 0 ? w : w[0].toUpperCase() + w.slice(1))).join('') || 'field'
  if (!/^[a-z]/.test(base)) base = `f${base}`
  let key = base
  for (let n = 2; taken.includes(key); n++) key = `${base}${n}`
  return key
}

const rate = z.number().min(0).max(1_000_000)

export const garmentTypeSchema = z.object({
  nameHi: z.string().trim().min(1).max(60),
  nameEn: z.string().trim().min(1).max(60),
  category: garmentCategorySchema,
  defaultRate: rate,
  defaultDeliveryDays: z.number().int().min(0).max(120),
  measurementFields: z.array(measurementFieldSchema).max(40),
  icon: z.string().max(8),
  active: z.boolean(),
  sortOrder: z.number().int(),
})
export type GarmentType = z.infer<typeof garmentTypeSchema>

export const addOnSchema = z.object({
  nameHi: z.string().trim().min(1).max(60),
  nameEn: z.string().trim().min(1).max(60),
  defaultRate: rate,
  active: z.boolean(),
  sortOrder: z.number().int(),
})
export type AddOn = z.infer<typeof addOnSchema>
