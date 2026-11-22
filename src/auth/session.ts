import {
  browserLocalPersistence,
  browserSessionPersistence,
  setPersistence,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth'
import { collection, doc, getDoc, getDocFromCache, onSnapshot, waitForPendingWrites, writeBatch, type DocumentReference } from 'firebase/firestore'
import { auth, db, googleProvider } from '@/lib/firebase'
import { DEFAULT_SETTINGS, inviteSchema, settingsSchema, shopSchema, userSchema, type Invite, type ShopUser } from '@/data/schemas'
import type { Language, Stored } from '@/data/types'
import { commitTracked, createRecord, logEvent, stageCreate, updateRecord, type WriteCtx } from '@/data/write'
import { seedMasterData } from '@/features/master/seed'
import { hashPin } from './pin'

const JUST_SIGNED_IN = 'gd.justSignedIn'
const RESET_PIN = 'gd.resetPin'

export type Member = Stored<ShopUser>

export type Membership =
  | { kind: 'member'; shopId: string }
  | { kind: 'invited'; email: string; invite: Invite }
  | { kind: 'none' }

function flag(storage: Storage, key: string, value?: boolean): boolean {
  try {
    if (value === true) storage.setItem(key, '1')
    if (value === false) storage.removeItem(key)
    return storage.getItem(key) === '1'
  } catch {
    return false
  }
}

export async function signInWithGoogle(remember: boolean): Promise<void> {
  await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence)
  // Popup, not redirect: redirect sign-in breaks on non-Firebase domains
  // (Cloudflare Pages) in browsers that partition third-party storage.
  await signInWithPopup(auth, googleProvider)
  flag(sessionStorage, JUST_SIGNED_IN, true)
}

/** True once right after an interactive Google sign-in (for the login audit entry and PIN reset). */
export function consumeJustSignedIn(): boolean {
  const was = flag(sessionStorage, JUST_SIGNED_IN)
  flag(sessionStorage, JUST_SIGNED_IN, false)
  return was
}

export const requestPinReset = () => flag(localStorage, RESET_PIN, true)
export const pinResetRequested = () => flag(localStorage, RESET_PIN)
export const clearPinReset = () => flag(localStorage, RESET_PIN, false)

/** Server when online, local cache when offline. */
async function readDoc(ref: DocumentReference) {
  try {
    return await getDoc(ref)
  } catch {
    return getDocFromCache(ref).catch(() => null)
  }
}

export async function findMembership(user: User): Promise<Membership> {
  const pointer = await readDoc(doc(db, 'userShops', user.uid))
  if (pointer?.exists()) return { kind: 'member', shopId: pointer.get('shopId') as string }
  const email = user.email?.toLowerCase()
  if (email) {
    const invite = await readDoc(doc(db, 'invites', email))
    if (invite?.exists() && invite.get('isDeleted') === false) {
      return { kind: 'invited', email, invite: invite.data() as Invite }
    }
  }
  return { kind: 'none' }
}

export interface SetupForm {
  shopName: string
  ownerName: string
  upiId: string
  language: Language
}

/** First run: creates the shop, makes this user its owner, and seeds settings. */
export function createShop(user: User, form: SetupForm): string {
  const shopId = doc(collection(db, 'shops')).id
  const ctx: WriteCtx = { shopId, uid: user.uid, actorName: form.ownerName }
  const batch = writeBatch(db)
  stageCreate(batch, ctx, 'shops', shopSchema, { name: form.shopName, ownerUid: user.uid }, { id: shopId, label: form.shopName })
  const staged = stageCreate(
    batch,
    ctx,
    'users',
    userSchema,
    { name: form.ownerName, email: user.email, role: 'owner', language: form.language },
    { id: user.uid, label: form.ownerName },
  )
  batch.set(doc(db, 'userShops', user.uid), { shopId })
  void commitTracked(batch, ctx, staged)
  // Separate batch: rules check membership against the state *before* a batch,
  // so settings can only be written once the membership above exists. Firestore
  // sends queued batches in order, so this is safe even offline.
  createRecord(
    ctx,
    'settings',
    settingsSchema,
    { ...DEFAULT_SETTINGS, shopName: form.shopName, upiId: form.upiId, language: form.language },
    { id: 'main', label: form.shopName },
  )
  // Third batch: the Rajasthani garment list, rates and add-ons (all editable).
  seedMasterData(ctx)
  return shopId
}

/** Accept an invite addressed to this Google account. */
export function joinShop(user: User, invite: Invite, language: Language): string {
  const ctx: WriteCtx = { shopId: invite.shopId, uid: user.uid, actorName: user.displayName ?? user.email ?? 'user' }
  const batch = writeBatch(db)
  const staged = stageCreate(
    batch,
    ctx,
    'users',
    userSchema,
    { name: invite.invitedName || user.displayName || user.email || 'user', email: user.email, role: invite.role, language },
    { id: user.uid, label: user.displayName ?? undefined },
  )
  batch.set(doc(db, 'userShops', user.uid), { shopId: invite.shopId })
  void commitTracked(batch, ctx, staged)
  return invite.shopId
}

export function watchMember(
  shopId: string,
  uid: string,
  onMember: (m: Member | null) => void,
  onRevoked: () => void,
): () => void {
  const ref = doc(db, 'shops', shopId, 'users', uid)
  let unsub = () => {}
  let stopped = false

  const subscribe = (attempt: number) => {
    unsub = onSnapshot(
      ref,
      (snap) => onMember(snap.exists() ? ({ id: snap.id, ...snap.data({ serverTimestamps: 'estimate' }) } as Member) : null),
      async (err) => {
        if (err.code !== 'permission-denied') return console.error('Member listener failed', err)
        // Denied can also mean "your new membership hasn't reached the server
        // yet" (first run / just joined). Wait for our queued writes, then retry;
        // only a denial with nothing pending means revoked or removed.
        await waitForPendingWrites(db).catch(() => undefined)
        if (stopped) return
        if (attempt < 2) subscribe(attempt + 1)
        else onRevoked()
      },
    )
  }

  subscribe(0)
  return () => {
    stopped = true
    unsub()
  }
}

export async function savePin(ctx: WriteCtx, me: Member, pin: string): Promise<void> {
  const { pinHash, pinSalt } = await hashPin(pin)
  updateRecord(ctx, 'users', userSchema, me, { pinHash, pinSalt }, { label: me.name, redactFields: ['pinHash', 'pinSalt'] })
}

/** Invite (or re-invite with a new role) someone by Gmail address. Managers only (rules). */
export async function inviteMember(ctx: WriteCtx, email: string, role: Invite['role'], invitedName?: string): Promise<void> {
  const id = email.trim().toLowerCase()
  const data: Invite = { shopId: ctx.shopId, role, ...(invitedName ? { invitedName } : {}) }
  const existing = await readDoc(doc(db, 'invites', id))
  if (existing?.exists()) {
    const current = { id, ...existing.data() } as Stored<Invite>
    // Re-inviting also re-activates a withdrawn invite.
    updateRecord(ctx, 'invites', inviteSchema, current, { ...data, isDeleted: false } as Partial<Invite>, { label: id })
  } else {
    createRecord(ctx, 'invites', inviteSchema, data, { id, label: id })
  }
}

export function logLogin(ctx: WriteCtx): void {
  logEvent(ctx, 'login')
}

/**
 * Revokes every session, including this one, via users/{uid}.revokedBefore
 * (enforced in firestore.rules). Needs the internet: the server must accept it.
 */
export async function signOutAllDevices(ctx: WriteCtx, me: Member): Promise<void> {
  // Log first: once revoked, this session can no longer write.
  logEvent(ctx, 'signOutAll')
  const { committed } = updateRecord(ctx, 'users', userSchema, me, {}, { label: me.name, serverTimeFields: ['revokedBefore'] })
  await committed
  await signOut(auth)
}

export async function signOutHere(ctx: WriteCtx | null): Promise<void> {
  if (ctx) logEvent(ctx, 'logout')
  await signOut(auth)
}
