import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { onAuthStateChanged, signOut, type User } from 'firebase/auth'
import { SYNCED_COLLECTIONS } from '@/data/collections'
import { reconcileOutbox, watchLeftoverWrites } from '@/data/outbox'
import { startDeltaSync } from '@/data/sync'
import type { WriteCtx } from '@/data/write'
import { useI18n } from '@/i18n'
import { auth, db } from '@/lib/firebase'
import { shouldRelock } from './pin'
import { JoinScreen, PinLockScreen, SetPinScreen, SetupScreen, SignInScreen } from './screens'
import {
  clearPinReset,
  consumeJustSignedIn,
  findMembership,
  logLogin,
  pinResetRequested,
  savePin,
  signOutAllDevices,
  signOutHere,
  watchMember,
  type Member,
  type Membership,
} from './session'
import { FullScreenMessage } from './ui'

interface Session {
  user: User
  shopId: string
  member: Member
  ctx: WriteCtx
  lock: () => void
  signOut: () => Promise<void>
  signOutAll: () => Promise<void>
}

const SessionContext = createContext<Session | null>(null)

export function useSession(): Session {
  const s = useContext(SessionContext)
  if (!s) throw new Error('useSession must be used inside AuthGate')
  return s
}

/**
 * Sign-in → shop membership → PIN. Renders children only for a signed-in,
 * unlocked member, and keeps delta sync running while they're in.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { t } = useI18n()
  const [user, setUser] = useState<User | null | undefined>(undefined)
  const [membership, setMembership] = useState<Membership | null>(null)
  const [creating, setCreating] = useState(false)
  const [member, setMember] = useState<Member | null | undefined>(undefined)
  const [locked, setLocked] = useState(true)
  const [justSignedIn, setJustSignedIn] = useState(false)
  const loginLogged = useRef(false)

  useEffect(
    () =>
      onAuthStateChanged(auth, (u) => {
        const fresh = !!u && consumeJustSignedIn()
        setUser(u)
        setMembership(null)
        setMember(undefined)
        setJustSignedIn(fresh)
        loginLogged.current = false
        // A "forgot PIN" reset is honoured only right after a fresh Google sign-in.
        setLocked(!(fresh && pinResetRequested()))
      }),
    [],
  )

  useEffect(() => {
    if (!user) return
    let cancelled = false
    void findMembership(user).then((m) => !cancelled && setMembership(m))
    return () => {
      cancelled = true
    }
  }, [user])

  const shopId = membership?.kind === 'member' ? membership.shopId : null

  useEffect(() => {
    if (!user || !shopId) return
    return watchMember(shopId, user.uid, setMember, () => void signOut(auth))
  }, [user, shopId])

  const ctx = useMemo<WriteCtx | null>(
    () => (user && shopId && member ? { shopId, uid: user.uid, actorName: member.name } : null),
    [user, shopId, member],
  )

  // Login audit entry, once per interactive Google sign-in.
  useEffect(() => {
    if (ctx && justSignedIn && !loginLogged.current) {
      loginLogged.current = true
      logLogin(ctx)
    }
  }, [ctx, justSignedIn])

  // Background data safety: sync, verify leftover writes, ask the browser not to evict storage.
  useEffect(() => {
    if (!shopId || !member) return
    void navigator.storage?.persist?.()
    watchLeftoverWrites(db)
    void reconcileOutbox(db)
    return startDeltaSync(shopId, SYNCED_COLLECTIONS, () => {})
  }, [shopId, member])

  // Re-ask for the PIN after 5 minutes in the background.
  useEffect(() => {
    let hiddenAt: number | null = null
    const onVis = () => {
      if (document.visibilityState === 'hidden') hiddenAt = Date.now()
      else if (shouldRelock(hiddenAt, Date.now())) setLocked(true)
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  const giveUp = useCallback(() => void signOutHere(ctx), [ctx])
  const unlock = useCallback(() => setLocked(false), [])
  const onPin = useCallback(
    (pin: string) => {
      if (!ctx || !member) return
      void savePin(ctx, member, pin)
      clearPinReset()
      setLocked(false)
    },
    [ctx, member],
  )

  if (user === undefined) return <FullScreenMessage>{t('loading')}</FullScreenMessage>
  if (user === null) return <SignInScreen />
  if (membership === null) return <FullScreenMessage>{t('loading')}</FullScreenMessage>

  if (membership.kind !== 'member') {
    const toMember = (id: string) => setMembership({ kind: 'member', shopId: id })
    if (membership.kind === 'invited' && !creating) {
      return <JoinScreen user={user} invite={membership.invite} onJoined={toMember} onCreateInstead={() => setCreating(true)} />
    }
    return <SetupScreen user={user} onDone={toMember} />
  }

  if (!member || !ctx || !shopId) return <FullScreenMessage>{t('loading')}</FullScreenMessage>

  // No PIN yet, or a "forgot PIN" reset right after re-signing in with Google.
  if (!member.pinHash || (pinResetRequested() && !locked)) return <SetPinScreen onPin={onPin} />
  if (locked) return <PinLockScreen member={member} onUnlock={unlock} onGiveUp={giveUp} />

  const session: Session = {
    user,
    shopId,
    member,
    ctx,
    lock: () => setLocked(true),
    signOut: () => signOutHere(ctx),
    signOutAll: () => signOutAllDevices(ctx, member),
  }
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>
}
