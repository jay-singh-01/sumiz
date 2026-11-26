import { z } from 'zod'

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const money = z.number().min(0).max(10_000_000)

export const EXPENSE_CATEGORIES = ['thread', 'buttons', 'lining', 'repair', 'karigar', 'electricity', 'other'] as const

export const expenseSchema = z.object({
  category: z.enum(EXPENSE_CATEGORIES),
  amount: z.number().positive().max(10_000_000),
  date: isoDate,
  note: z.string().trim().max(300),
  /** Set when the expense is a payout to a karigar. */
  karigarId: z.string().nullable(),
})
export type Expense = z.infer<typeof expenseSchema>

export const karigarSchema = z.object({
  name: z.string().trim().min(1).max(80),
  phone: z.string().trim().max(15),
  ratePerPiece: money,
  active: z.boolean(),
  notes: z.string().trim().max(300),
})
export type Karigar = z.infer<typeof karigarSchema>

export const materialSchema = z.object({
  name: z.string().trim().min(1).max(60),
  qty: z.number().min(0).max(1_000_000),
  minQty: z.number().min(0).max(1_000_000),
  unit: z.string().trim().max(20),
  active: z.boolean(),
})
export type Material = z.infer<typeof materialSchema>

export const isLow = (m: Pick<Material, 'qty' | 'minQty' | 'active'>) => m.active && m.qty <= m.minQty
