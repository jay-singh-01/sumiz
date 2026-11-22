import { z } from 'zod'

/*
 * One measurement session for one garment. Never overwritten: taking new
 * measurements creates a new document, so the full history is kept.
 * Values are kept as typed ("34½", "34 1/2", "12") — tailors write fractions.
 */
export const measurementSchema = z.object({
  customerId: z.string().min(1),
  garmentTypeId: z.string().min(1),
  /** Snapshot of the garment name, so history still reads right if the type is renamed. */
  garmentName: z.string().trim().min(1).max(60),
  values: z.record(z.string(), z.string().trim().max(20)),
  notes: z.string().trim().max(1000),
  takenOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  photoUrl: z.string().url().nullable(),
})
export type Measurement = z.infer<typeof measurementSchema>
