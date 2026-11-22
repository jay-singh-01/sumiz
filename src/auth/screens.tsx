import { useState } from 'react'
import type { User } from 'firebase/auth'
import { upiIdSchema, type Invite } from '@/data/schemas'
import { useI18n } from '@/i18n'
import { MAX_PIN_ATTEMPTS, verifyPin } from './pin'
import { createShop, joinShop, requestPinReset, signInWithGoogle, type Member } from './session'
import { BigButton, Field, inputClass, PinPad, Screen } from './ui'

export function SignInScreen() {
  const { t } = useI18n()
  const [remember, setRemember] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)

  const go = async () => {
    setBusy(true)
    setError(false)
    try {
      await signInWithGoogle(remember)
    } catch (err) {
      console.error(err)
      setError(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen title={t('signInTitle')} help={t('signInHelp')}>
      <BigButton onClick={go} disabled={busy}>
        🔐 {t('signInWithGoogle')}
      </BigButton>
      <label className="flex min-h-12 items-center gap-3 text-lg">
        <input type="checkbox" className="size-6 accent-rani" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
        {t('rememberDevice')}
      </label>
      {error && (
        <p role="alert" className="text-lg font-semibold text-red-700">
          ⚠️ {t('signInFailed')}
        </p>
      )}
    </Screen>
  )
}

export function SetupScreen({ user, onDone }: { user: User; onDone: (shopId: string) => void }) {
  const { t, lang, setLang } = useI18n()
  const [shopName, setShopName] = useState(t('appName'))
  const [ownerName, setOwnerName] = useState(user.displayName ?? '')
  const [upiId, setUpiId] = useState('')
  const [tried, setTried] = useState(false)

  const errors = {
    shopName: shopName.trim() ? undefined : t('required'),
    ownerName: ownerName.trim() ? undefined : t('required'),
    upiId: !upiId.trim() || upiIdSchema.safeParse(upiId).success ? undefined : t('invalidUpi'),
  }
  const valid = !errors.shopName && !errors.ownerName && !errors.upiId

  const submit = () => {
    setTried(true)
    if (!valid) return
    onDone(createShop(user, { shopName: shopName.trim(), ownerName: ownerName.trim(), upiId: upiId.trim(), language: lang }))
  }

  return (
    <Screen title={t('setupTitle')} help={t('setupHelp')}>
      <Field label={t('shopName')} error={tried ? errors.shopName : undefined}>
        <input className={inputClass} value={shopName} onChange={(e) => setShopName(e.target.value)} />
      </Field>
      <Field label={t('yourName')} error={tried ? errors.ownerName : undefined}>
        <input className={inputClass} value={ownerName} onChange={(e) => setOwnerName(e.target.value)} autoComplete="name" />
      </Field>
      <Field label={t('upiId')} hint={t('upiOptional')} error={tried ? errors.upiId : undefined}>
        <input
          className={inputClass}
          value={upiId}
          onChange={(e) => setUpiId(e.target.value)}
          inputMode="email"
          autoCapitalize="none"
          placeholder="sumitra@okaxis"
        />
      </Field>
      <Field label={t('language')}>
        <div className="grid grid-cols-2 gap-3">
          <BigButton variant={lang === 'hi' ? 'primary' : 'secondary'} onClick={() => setLang('hi')}>
            हिंदी
          </BigButton>
          <BigButton variant={lang === 'en' ? 'primary' : 'secondary'} onClick={() => setLang('en')}>
            English
          </BigButton>
        </div>
      </Field>
      <BigButton className="mt-auto" onClick={submit}>
        ✅ {t('saveAndContinue')}
      </BigButton>
    </Screen>
  )
}

export function JoinScreen({
  user,
  invite,
  onJoined,
  onCreateInstead,
}: {
  user: User
  invite: Invite
  onJoined: (shopId: string) => void
  onCreateInstead: () => void
}) {
  const { t, lang } = useI18n()
  return (
    <Screen title={t('joinTitle')} help={t('joinHelp')}>
      <p className="rounded-2xl border-2 border-gold bg-white p-4 text-xl">
        {user.email} · {t(`role_${invite.role}`)}
      </p>
      <BigButton onClick={() => onJoined(joinShop(user, invite, lang))}>🤝 {t('join')}</BigButton>
      <BigButton variant="secondary" onClick={onCreateInstead}>
        {t('newShop')}
      </BigButton>
    </Screen>
  )
}

export function SetPinScreen({ onPin }: { onPin: (pin: string) => void }) {
  const { t } = useI18n()
  const [first, setFirst] = useState<string | null>(null)
  const [value, setValue] = useState('')
  const [mismatch, setMismatch] = useState(false)

  const onChange = (next: string) => {
    if (next.length !== 4) return setValue(next)
    setValue('')
    if (first === null) {
      setFirst(next)
      setMismatch(false)
    } else if (next === first) {
      onPin(next)
    } else {
      navigator.vibrate?.([60, 40, 60])
      setFirst(null)
      setMismatch(true)
    }
  }

  return (
    <Screen title={first === null ? t('setPinTitle') : t('confirmPinTitle')} help={t('setPinHelp')}>
      {mismatch && (
        <p role="alert" className="text-lg font-semibold text-red-700">
          ⚠️ {t('pinMismatch')}
        </p>
      )}
      <PinPad value={value} onChange={onChange} />
    </Screen>
  )
}

export function PinLockScreen({ member, onUnlock, onGiveUp }: { member: Member; onUnlock: () => void; onGiveUp: () => void }) {
  const { t } = useI18n()
  const [value, setValue] = useState('')
  const [attempts, setAttempts] = useState(0)
  const [checking, setChecking] = useState(false)
  const [showForgot, setShowForgot] = useState(false)

  const onChange = async (next: string) => {
    setValue(next)
    if (next.length !== 4 || !member.pinHash || !member.pinSalt) return
    setChecking(true)
    const ok = await verifyPin(next, member.pinHash, member.pinSalt)
    setChecking(false)
    if (ok) return onUnlock()
    navigator.vibrate?.([60, 40, 60])
    const tries = attempts + 1
    setAttempts(tries)
    setValue('')
    if (tries >= MAX_PIN_ATTEMPTS) onGiveUp()
  }

  return (
    <Screen title={t('enterPinTitle')} help={t('welcome', { name: member.name })}>
      {attempts > 0 && (
        <p role="alert" className="text-lg font-semibold text-red-700">
          ⚠️ {t('wrongPin', { n: MAX_PIN_ATTEMPTS - attempts })}
        </p>
      )}
      <PinPad value={value} onChange={(v) => void onChange(v)} disabled={checking} />
      <button type="button" className="mt-4 min-h-12 text-lg font-semibold text-indigo-royal underline" onClick={() => setShowForgot(true)}>
        {t('forgotPin')}
      </button>
      {showForgot && (
        <div className="rounded-2xl border-2 border-gold bg-white p-4">
          <p className="mb-3 text-lg">{t('forgotPinHelp')}</p>
          <BigButton
            variant="secondary"
            onClick={() => {
              requestPinReset()
              onGiveUp()
            }}
          >
            🔐 {t('signInWithGoogle')}
          </BigButton>
        </div>
      )}
    </Screen>
  )
}
