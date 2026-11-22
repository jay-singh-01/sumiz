import { writeBatch } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { commitTracked, stageCreate, type StagedWrite, type WriteCtx } from '@/data/write'
import { addOnSchema, garmentTypeSchema, type AddOn, type GarmentType } from './schema'
import { SEED_ADDONS, SEED_GARMENTS } from './seedData'

/** Adds every default garment type and add-on (skipping ids that exist) in one atomic, audited batch. */
export function seedMasterData(ctx: WriteCtx, existing: { garmentIds: Set<string>; addOnIds: Set<string> } = { garmentIds: new Set(), addOnIds: new Set() }) {
  const batch = writeBatch(db)
  let last: StagedWrite | null = null
  SEED_GARMENTS.forEach(([id, nameHi, nameEn, category, defaultRate, defaultDeliveryDays, icon, measurementFields], i) => {
    if (existing.garmentIds.has(id)) return
    const data: GarmentType = { nameHi, nameEn, category, defaultRate, defaultDeliveryDays, icon, measurementFields, active: true, sortOrder: i * 10 }
    last = stageCreate(batch, ctx, 'garmentTypes', garmentTypeSchema, data, { id, label: nameHi })
  })
  SEED_ADDONS.forEach(([id, nameHi, nameEn, defaultRate], i) => {
    if (existing.addOnIds.has(id)) return
    const data: AddOn = { nameHi, nameEn, defaultRate, active: true, sortOrder: i * 10 }
    last = stageCreate(batch, ctx, 'addOns', addOnSchema, data, { id, label: nameHi })
  })
  if (last) void commitTracked(batch, ctx, last)
}
