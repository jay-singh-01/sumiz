/** Shop-scoped collections that follow the versioned + audited pattern. Keep in sync with firestore.rules. */
export const BUSINESS_COLLECTIONS = [
  'customers',
  'measurements',
  'orders',
  'bills',
  'payments',
  'reminders',
  'expenses',
  'karigars',
  'garmentTypes',
  'addOns',
  'settings',
  'counters',
  'materials',
] as const

export type BusinessCollection = (typeof BUSINESS_COLLECTIONS)[number]

/** Everything written through the audited write helper. */
export type AuditedCollection = BusinessCollection | 'users' | 'shops' | 'invites'

/** Collections mirrored to every device. The audit log is deliberately excluded: it's paginated on demand. */
export const SYNCED_COLLECTIONS: readonly AuditedCollection[] = [...BUSINESS_COLLECTIONS, 'users']

/** Deterministic audit-log id. firestore.rules checks this entry exists for every business write. */
export function auditId(coll: string, id: string, version: number): string {
  return `${coll}_${id}_v${version}`
}

/** Firestore path segments for a document in an audited collection. */
export function docPath(shopId: string, coll: AuditedCollection, id: string): string {
  if (coll === 'shops') return `shops/${shopId}`
  if (coll === 'invites') return `invites/${id}`
  return `shops/${shopId}/${coll}/${id}`
}
