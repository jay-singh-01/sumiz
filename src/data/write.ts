import {
  collection,
  doc,
  serverTimestamp,
  writeBatch,
  type DocumentData,
  type DocumentReference,
  type WriteBatch,
} from 'firebase/firestore'
import type { ZodType } from 'zod'
import { db } from '@/lib/firebase'
import { auditId, docPath, type AuditedCollection } from './collections'
import { describeDevice } from './device'
import { diffFields } from './diff'
import { trackCommit } from './outbox'
import type { AuditAction, FieldChange, Meta, Stored } from './types'

/*
 * The ONLY way the app writes data. Every function here:
 *  - validates with Zod,
 *  - writes the record and its audit-log entry in one atomic batch
 *    (firestore.rules rejects a business write without its audit entry),
 *  - bumps `version` (rules reject stale versions from another device),
 *  - returns immediately: the write is already in the local cache, so the
 *    UI never waits for the network. Server rejections land in the outbox's
 *    conflicts store instead of vanishing.
 */

export interface WriteCtx {
  shopId: string
  uid: string
  actorName: string
}

interface WriteOpts {
  /** Human label for the audit trail, e.g. the customer's name. */
  label?: string
  /** Fields whose values must never reach the audit log or outbox (e.g. PIN hash). */
  redactFields?: string[]
  /** Fields set to the server's clock (Firestore sentinel), recorded in the diff as "server time". */
  serverTimeFields?: string[]
}

export interface WriteResult {
  id: string
  /** Resolves when the server has accepted the write. Rarely needed: don't block UI on it. */
  committed: Promise<void>
}

export interface StagedWrite {
  coll: string
  id: string
  action: AuditAction
  auditDocId: string
  data: unknown
}

const SERVER_TIME = '(server time)'
const REDACTED = '•••'

function ref(ctx: WriteCtx, coll: AuditedCollection, id: string): DocumentReference {
  return doc(db, docPath(ctx.shopId, coll, id))
}

function auditRef(ctx: WriteCtx, id: string): DocumentReference {
  return doc(db, `shops/${ctx.shopId}/auditLogs/${id}`)
}

function auditBody(
  ctx: WriteCtx,
  action: AuditAction,
  entityType: string,
  entityId: string,
  extra: { label?: string; changes?: Record<string, FieldChange>; note?: string },
) {
  return {
    actorUid: ctx.uid,
    actorName: ctx.actorName,
    at: serverTimestamp(),
    device: describeDevice(),
    action,
    entityType,
    entityId,
    ...(extra.label ? { entityLabel: extra.label } : {}),
    ...(extra.changes && Object.keys(extra.changes).length ? { changes: extra.changes } : {}),
    ...(extra.note ? { note: extra.note } : {}),
  }
}

function redactChanges(changes: Record<string, FieldChange>, fields: string[] | undefined) {
  for (const f of fields ?? []) {
    if (f in changes) changes[f] = { from: changes[f].from == null ? null : REDACTED, to: REDACTED }
  }
  return changes
}

function redactData(data: Record<string, unknown>, fields: string[] | undefined) {
  if (!fields?.length) return data
  const copy = { ...data }
  for (const f of fields) if (f in copy) copy[f] = REDACTED
  return copy
}

function withServerTime(fields: string[] | undefined) {
  const values: Record<string, unknown> = {}
  const changes: Record<string, FieldChange> = {}
  for (const f of fields ?? []) {
    values[f] = serverTimestamp()
    changes[f] = { from: null, to: SERVER_TIME }
  }
  return { values, changes }
}

/** Commit a batch built with stageCreate, with outbox tracking. */
export function commitTracked(batch: WriteBatch, ctx: WriteCtx, info: StagedWrite): Promise<void> {
  const committed = batch.commit()
  trackCommit({ key: `${info.auditDocId}@${ctx.shopId}`, shopId: ctx.shopId, uid: ctx.uid, ...info }, committed)
  return committed
}

/** A WriteBatch or a Transaction: anything we can stage writes into. */
export interface Stager {
  set(ref: DocumentReference, data: DocumentData): unknown
  update(ref: DocumentReference, data: DocumentData): unknown
}

/** Adds a create (record + audit entry) to `batch` without committing. */
export function stageCreate<T extends Record<string, unknown>>(
  batch: Stager,
  ctx: WriteCtx,
  coll: AuditedCollection,
  schema: ZodType<T>,
  data: T,
  opts: WriteOpts & { id?: string } = {},
): StagedWrite {
  const parsed = schema.parse(data) as Record<string, unknown>
  const id = opts.id ?? doc(collection(db, '_ids')).id
  const meta = {
    version: 1,
    createdBy: ctx.uid,
    updatedBy: ctx.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    isDeleted: false,
  }
  const st = withServerTime(opts.serverTimeFields)
  const aid = auditId(coll, id, 1)
  const changes = redactChanges({ ...diffFields(null, parsed), ...st.changes }, opts.redactFields)
  batch.set(ref(ctx, coll, id), { ...parsed, ...st.values, ...meta })
  batch.set(auditRef(ctx, aid), auditBody(ctx, 'create', coll, id, { label: opts.label, changes }))
  return { coll, id, action: 'create', auditDocId: aid, data: redactData(parsed, opts.redactFields) }
}

export function createRecord<T extends Record<string, unknown>>(
  ctx: WriteCtx,
  coll: AuditedCollection,
  schema: ZodType<T>,
  data: T,
  opts: WriteOpts & { id?: string } = {},
): WriteResult {
  const batch = writeBatch(db)
  const staged = stageCreate(batch, ctx, coll, schema, data, opts)
  return { id: staged.id, committed: commitTracked(batch, ctx, staged) }
}

/** Strips Meta and id so the stored doc can be re-validated as plain data. */
function dataOf<T>(current: Stored<T>): Record<string, unknown> {
  const {
    id: _id,
    version: _v,
    createdAt: _ca,
    createdBy: _cb,
    updatedAt: _ua,
    updatedBy: _ub,
    isDeleted: _d,
    deletedAt: _da,
    deletedBy: _db,
    ...rest
  } = current as Stored<T> & Meta
  return rest
}

/**
 * Adds a versioned, audited update to `batch` without committing.
 * Returns null when the patch changes nothing.
 */
export function stageUpdate<T extends Record<string, unknown>>(
  batch: Stager,
  ctx: WriteCtx,
  coll: AuditedCollection,
  schema: ZodType<T>,
  current: Stored<T>,
  patch: Partial<T>,
  opts: WriteOpts = {},
): StagedWrite | null {
  const before = dataOf(current)
  // Validate the whole record as it will look after the patch.
  schema.parse({ ...before, ...patch })
  const changes = diffFields(before, patch as Record<string, unknown>)
  const st = withServerTime(opts.serverTimeFields)
  if (Object.keys(changes).length === 0 && Object.keys(st.values).length === 0) return null
  return stageVersioned(batch, ctx, coll, current, 'update', { ...patch, ...st.values }, redactChanges({ ...changes, ...st.changes }, opts.redactFields), opts)
}

export function updateRecord<T extends Record<string, unknown>>(
  ctx: WriteCtx,
  coll: AuditedCollection,
  schema: ZodType<T>,
  current: Stored<T>,
  patch: Partial<T>,
  opts: WriteOpts = {},
): WriteResult {
  const batch = writeBatch(db)
  const staged = stageUpdate(batch, ctx, coll, schema, current, patch, opts)
  if (!staged) return { id: current.id, committed: Promise.resolve() }
  return { id: current.id, committed: commitTracked(batch, ctx, staged) }
}

export function softDeleteRecord<T>(ctx: WriteCtx, coll: AuditedCollection, current: Stored<T>, opts: WriteOpts = {}): WriteResult {
  return versionedUpdate(
    ctx,
    coll,
    current,
    'delete',
    { isDeleted: true, deletedBy: ctx.uid, deletedAt: serverTimestamp() },
    { isDeleted: { from: false, to: true } },
    opts,
  )
}

export function restoreRecord<T>(ctx: WriteCtx, coll: AuditedCollection, current: Stored<T>, opts: WriteOpts = {}): WriteResult {
  return versionedUpdate(ctx, coll, current, 'restore', { isDeleted: false }, { isDeleted: { from: true, to: false } }, opts)
}

function stageVersioned<T>(
  batch: Stager,
  ctx: WriteCtx,
  coll: AuditedCollection,
  current: Stored<T>,
  action: AuditAction,
  fields: Record<string, unknown>,
  changes: Record<string, FieldChange>,
  opts: WriteOpts,
): StagedWrite {
  const version = current.version + 1
  const aid = auditId(coll, current.id, version)
  batch.update(ref(ctx, coll, current.id), { ...fields, version, updatedBy: ctx.uid, updatedAt: serverTimestamp() })
  batch.set(auditRef(ctx, aid), auditBody(ctx, action, coll, current.id, { label: opts.label, changes }))
  return { coll, id: current.id, action, auditDocId: aid, data: redactData(fields, opts.redactFields) }
}

function versionedUpdate<T>(
  ctx: WriteCtx,
  coll: AuditedCollection,
  current: Stored<T>,
  action: AuditAction,
  fields: Record<string, unknown>,
  changes: Record<string, FieldChange>,
  opts: WriteOpts,
): WriteResult {
  const batch = writeBatch(db)
  const staged = stageVersioned(batch, ctx, coll, current, action, fields, changes, opts)
  return { id: current.id, committed: commitTracked(batch, ctx, staged) }
}

/**
 * Restore from a backup: writes the record's backed-up fields with fresh,
 * rule-compliant bookkeeping (a new record starts at version 1; an existing or
 * deleted one gets version + 1 and keeps its original creation fields) and an
 * audit entry with action "restoreBackup".
 */
export function stageRestore(
  batch: Stager,
  ctx: WriteCtx,
  coll: AuditedCollection,
  id: string,
  fields: Record<string, unknown>,
  current: (Meta & { id: string }) | null,
  label?: string,
): StagedWrite {
  const version = current ? current.version + 1 : 1
  const aid = auditId(coll, id, version)
  const meta = current
    ? { createdAt: current.createdAt, createdBy: current.createdBy, version, updatedBy: ctx.uid, updatedAt: serverTimestamp(), isDeleted: false }
    : { version: 1, createdBy: ctx.uid, updatedBy: ctx.uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), isDeleted: false }
  batch.set(ref(ctx, coll, id), { ...fields, ...meta })
  batch.set(auditRef(ctx, aid), auditBody(ctx, 'restoreBackup', coll, id, { label, note: current ? (current.isDeleted ? 'undeleted from backup' : 'reverted to backup') : 'recreated from backup' }))
  return { coll, id, action: 'restoreBackup', auditDocId: aid, data: null }
}

/** The ref an audited record lives at (for transactions that read before writing). */
export function recordRef(ctx: WriteCtx, coll: AuditedCollection, id: string): DocumentReference {
  return ref(ctx, coll, id)
}

/** Non-record events: login, export, backup, sign-out-all. */
export function logEvent(
  ctx: WriteCtx,
  action: AuditAction,
  opts: { entityType?: string; entityId?: string; label?: string; note?: string } = {},
): WriteResult {
  const batch = writeBatch(db)
  const aid = `evt_${doc(collection(db, '_ids')).id}`
  const entityType = opts.entityType ?? 'session'
  const entityId = opts.entityId ?? ctx.uid
  batch.set(auditRef(ctx, aid), auditBody(ctx, action, entityType, entityId, { label: opts.label, note: opts.note }))
  const committed = commitTracked(batch, ctx, { coll: 'auditLogs', id: aid, action, auditDocId: aid, data: null })
  return { id: aid, committed }
}
