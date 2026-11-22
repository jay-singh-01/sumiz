import {
  browserLocalPersistence,
  browserSessionPersistence,
  setPersistence,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth'
import { collection, doc, getDoc, getDocFromCache, onSnapshot, writeBatch, type DocumentReference } from 'firebase/firestore'
import { auth, db, googleProvider } from '@/lib/firebase'
import { DEFAULT_SETTINGS, settingsSchema, shopSchema, userSchema, type Invite, type ShopUser } from '@/data/schemas'
import type { Language, Stored } from '@/data/types'
import { commitTracked, createRecord, logEvent, stageCreate, updateRecord, type WriteCtx } from '@/data/write'
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
  return onSnapshot(
    doc(db, 'shops', shopId, 'users', uid),
    (snap) => onMember(snap.exists() ? ({ id: snap.id, ...snap.data({ serverTimestamps: 'estimate' }) } as Member) : null),
    (err) => {
      // Rules deny reads once this session is revoked or the user is removed.
      if (err.code === 'permission-denied') onRevoked()
      else console.error('Member listener failed', err)
    },
  )
}

export async function savePin(ctx: WriteCtx, me: Member, pin: string): Promise<void> {
  const { pinHash, pinSalt } = await hashPin(pin)
  updateRecord(ctx, 'users', userSchema, me, { pinHash, pinSalt }, { label: me.name, redactFields: ['pinHash', 'pinSalt'] })
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
