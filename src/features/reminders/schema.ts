import { z } from 'zod'
import { REMINDER_TYPES } from './templates'

/** One reminder sent (logged when she taps "send"; createdAt/createdBy = when and by whom). */
export const reminderSchema = z.object({
  customerId: z.string().min(1),
  customerName: z.string().trim().min(1).max(80),
  type: z.enum(REMINDER_TYPES),
  message: z.string().trim().min(1).max(1000),
  channel: z.enum(['whatsapp']),
  orderId: z.string().nullable(),
  billId: z.string().nullable(),
  amount: z.number().min(0).nullable(),
})
export type Reminder = z.infer<typeof reminderSchema>
