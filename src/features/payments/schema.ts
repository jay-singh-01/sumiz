import { z } from 'zod'

export const PAYMENT_MODES = ['cash', 'upi', 'other'] as const
export type PaymentMode = (typeof PAYMENT_MODES)[number]

/*
 * Money received. The customer's balance is always derived from bills minus
 * payments, never stored, so it can't drift.
 *  - advance: taken when the order is placed (orderId set)
 *  - payment: received later, against a bill or on account
 *  - opening: old balance carried over from the paper diary (Phase 10)
 */
export const paymentSchema = z.object({
  customerId: z.string().min(1),
  customerName: z.string().trim().min(1).max(80),
  orderId: z.string().nullable(),
  billId: z.string().nullable(),
  amount: z.number().positive().max(10_000_000),
  mode: z.enum(PAYMENT_MODES),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  kind: z.enum(['advance', 'payment', 'opening']),
  note: z.string().trim().max(300),
})
export type Payment = z.infer<typeof paymentSchema>
