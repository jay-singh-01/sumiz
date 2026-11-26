import { z } from 'zod'

const money = z.number().min(0).max(10_000_000)

export const billLineSchema = z.object({
  name: z.string().trim().min(1).max(80),
  qty: z.number().int().min(1).max(100),
  rate: money,
  addOns: z.array(z.object({ name: z.string().trim().min(1).max(60), rate: money })).max(20),
})
export type BillLine = z.infer<typeof billLineSchema>

export const discountSchema = z.object({
  type: z.enum(['flat', 'percent']),
  value: z.number().min(0).max(10_000_000),
})

/** A previous version of the bill, kept when an issued bill is edited. */
export const billRevisionSchema = z.object({
  revision: z.number().int().min(1),
  billDate: z.string(),
  lines: z.array(billLineSchema),
  discount: discountSchema,
  roundOff: z.boolean(),
  total: money,
  savedAt: z.string(),
  savedBy: z.string(),
})
export type BillRevision = z.infer<typeof billRevisionSchema>

export const billSchema = z.object({
  /** Same as the order number for bills made from an order. */
  billNumber: z.string().min(1).max(40),
  customerId: z.string().min(1),
  customerName: z.string().trim().min(1).max(80),
  customerPhone: z.string().max(15),
  orderId: z.string().nullable(),
  billDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  lines: z.array(billLineSchema).min(1).max(100),
  discount: discountSchema,
  roundOff: z.boolean(),
  /** Grand total at issue, computed by the bill math (stored so ledgers are fast and auditable). */
  total: money,
  revision: z.number().int().min(1),
  revisions: z.array(billRevisionSchema).max(50),
  notes: z.string().trim().max(500),
  /** GST % applied on this bill (absent / 0 = none) and the GSTIN printed on it. */
  gstPercent: z.number().min(0).max(28).optional(),
  gstin: z.string().max(15).optional(),
})
export type Bill = z.infer<typeof billSchema>
