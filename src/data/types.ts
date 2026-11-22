import type { Timestamp } from 'firebase/firestore'

export type Role = 'owner' | 'admin' | 'helper'
export type Language = 'hi' | 'en'

/** Bookkeeping fields every audited document carries. Rules enforce them. */
export interface Meta {
  version: number
  createdAt: Timestamp | null // null only while a local write is pending
  createdBy: string
  updatedAt: Timestamp | null
  updatedBy: string
  isDeleted: boolean
  deletedAt?: Timestamp | null
  deletedBy?: string
}

export type WithId<T> = T & { id: string }
export type Stored<T> = WithId<T & Meta>

export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'restore'
  | 'login'
  | 'logout'
  | 'export'
  | 'backup'
  | 'restoreBackup'
  | 'signOutAll'

export interface FieldChange {
  from: unknown
  to: unknown
}

export interface AuditEntry {
  actorUid: string
  actorName: string
  at: Timestamp | null
  device: string
  action: AuditAction
  entityType: string
  entityId: string
  entityLabel?: string
  changes?: Record<string, FieldChange>
  note?: string
}
