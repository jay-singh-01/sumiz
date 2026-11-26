import { AlertTriangle, KeyRound, ShieldCheck, Lock, LogOut, MonitorSmartphone, Palette, Shirt, Store, Type, UserPlus, Users } from 'lucide-react'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { Link } from 'react-router'
import { z } from 'zod'
import { useSession } from '@/auth/AuthGate'
import { SetPinScreen } from '@/auth/screens'
import { inviteMember, savePin, type Member } from '@/auth/session'
import { Button } from '@/components/ui/button'
import { ArchCard } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/dialog'
import { inputClass, TextField } from '@/components/ui/field'
import { SwitchRow } from '@/components/ui/switch'
import { toast } from '@/components/ui/toast'
import { useCollection } from '@/data/hooks'
import { dismissConflict, getConflictTick, listConflicts, subscribeOutbox, type ConflictEntry } from '@/data/outbox'
import { settingsSchema, type Settings, type ShopUser } from '@/data/schemas'
import type { Stored } from '@/data/types'
import { updateRecord } from '@/data/write'
import { TemplatesEditor } from '@/features/reminders/TemplatesEditor'
import { useI18n } from '@/i18n'
import { useDisplayPrefs } from './display'
import { useIsManager, useSettings } from './useShop'

const BRAND_FIELDS = ['shopName', 'subLine', 'tagline', 'address', 'phone', 'upiId', 'billFooter', 'orderPrefix'] as const
type BrandField = (typeof BRAND_FIELDS)[number]

function ShopDetails() {
  const { settings, doc } = useSettings()
  // Remount the form when a newer version arrives (e.g. edited on another phone).
  return <ShopDetailsForm key={doc?.version ?? 0} settings={settings} doc={doc ?? null} />
}

function ShopDetailsForm({ settings, doc }: { settings: Settings; doc: Stored<Settings> | null }) {
  const { t } = useI18n()
  const { ctx } = useSession()
  const isManager = useIsManager()
  const [draft, setDraft] = useState<Pick<Settings, BrandField>>(settings)
  const [errors, setErrors] = useState<Partial<Record<BrandField, string>>>({})

  const labels: Record<BrandField, string> = {
    shopName: t('shopName'),
    subLine: t('subLine'),
    tagline: t('tagline'),
    address: t('address'),
    phone: t('phone'),
    upiId: t('upiId'),
    billFooter: t('billFooter'),
    orderPrefix: t('orderPrefix'),
  }

  const save = () => {
    if (!doc) return
    const result = settingsSchema.safeParse({ ...doc, ...draft })
    if (!result.success) {
      const errs: Partial<Record<BrandField, string>> = {}
      for (const issue of result.error.issues) {
        const key = issue.path[0] as BrandField
        errs[key] = key === 'upiId' ? t('invalidUpi') : t('required')
      }
      setErrors(errs)
      return
    }
    setErrors({})
    const before = Object.fromEntries(BRAND_FIELDS.map((k) => [k, doc[k]])) as Partial<Settings>
    const patch = Object.fromEntries(BRAND_FIELDS.map((k) => [k, result.data[k]])) as Partial<Settings>
    updateRecord(ctx, 'settings', settingsSchema, doc, patch, { label: result.data.shopName })
    toast({
      message: t('saved'),
      undo: () => updateRecord(ctx, 'settings', settingsSchema, { ...doc, ...patch, version: doc.version + 1 }, before, { label: doc.shopName }),
    })
  }

  return (
    <ArchCard title={t('shopDetails')} icon={<Store />}>
      <p className="mb-3 text-ink-muted">{isManager ? t('shopDetailsHelp') : t('onlyManagers')}</p>
      <div className="grid gap-4 md:grid-cols-2">
        {BRAND_FIELDS.map((k) => (
          <TextField
            key={k}
            label={labels[k]}
            value={draft[k]}
            disabled={!isManager || !doc}
            error={errors[k]}
            hint={k === 'orderPrefix' ? t('orderPrefixHint') : undefined}
            inputMode={k === 'phone' ? 'tel' : k === 'upiId' ? 'email' : undefined}
            autoCapitalize={k === 'upiId' ? 'none' : undefined}
            onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))}
          />
        ))}
      </div>
      {isManager && (
        <Button className="mt-4" block onClick={save} disabled={!doc}>
          {t('save')}
        </Button>
      )}
    </ArchCard>
  )
}

function Display() {
  const { t, lang, setLang } = useI18n()
  const [prefs, setPrefs] = useDisplayPrefs()
  return (
    <ArchCard title={t('display')} icon={<Type />}>
      <div className="mb-3 grid grid-cols-2 gap-3">
        <Button variant={lang === 'hi' ? 'primary' : 'secondary'} onClick={() => setLang('hi')}>
          हिंदी
        </Button>
        <Button variant={lang === 'en' ? 'primary' : 'secondary'} onClick={() => setLang('en')}>
          English
        </Button>
      </div>
      <SwitchRow label={t('largeText')} hint={t('largeTextHint')} checked={prefs.largeText} onCheckedChange={(v) => setPrefs({ largeText: v })} />
    </ArchCard>
  )
}

const emailSchema = z.email()

function Team() {
  const { t } = useI18n()
  const { ctx, shopId } = useSession()
  const members = useCollection<ShopUser>(shopId, 'users')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'helper' | 'admin'>('helper')
  const [error, setError] = useState<string>()

  const submit = async () => {
    if (!emailSchema.safeParse(email.trim()).success) return setError(t('invalidEmail'))
    setError(undefined)
    await inviteMember(ctx, email, role)
    toast({ message: t('invited', { email: email.trim() }) })
    setEmail('')
  }

  return (
    <ArchCard title={t('team')} icon={<Users />}>
      <ul className="mb-4 flex flex-col gap-2">
        {members?.map((m: Stored<ShopUser>) => (
          <li key={m.id} className="flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2">
            <span>
              <span className="font-semibold">{m.name}</span>
              <span className="block text-sm text-ink-muted">{m.email}</span>
            </span>
            <span className="rounded-full bg-indigo-royal px-3 py-1 text-sm font-semibold text-on-indigo">{t(`role_${m.role}`)}</span>
          </li>
        ))}
      </ul>
      <p className="mb-3 text-ink-muted">{t('teamHelp')}</p>
      <div className="flex flex-col gap-3">
        <TextField
          label={t('inviteEmail')}
          type="email"
          inputMode="email"
          autoCapitalize="none"
          placeholder="name@gmail.com"
          value={email}
          error={error}
          onChange={(e) => setEmail(e.target.value)}
        />
        <label className="flex flex-col gap-1">
          <span className="text-lg font-semibold">{t('inviteRole')}</span>
          <select className={inputClass} value={role} onChange={(e) => setRole(e.target.value as 'helper' | 'admin')}>
            <option value="helper">{t('role_helper')}</option>
            <option value="admin">{t('role_admin')}</option>
          </select>
        </label>
        <Button onClick={() => void submit()}>
          <UserPlus /> {t('invite')}
        </Button>
      </div>
    </ArchCard>
  )
}

function Security({ onChangePin }: { onChangePin: () => void }) {
  const { t } = useI18n()
  const { lock, signOut, signOutAll } = useSession()
  const [confirmAll, setConfirmAll] = useState(false)
  const [offlineMsg, setOfflineMsg] = useState(false)
  return (
    <ArchCard title={t('security')} icon={<Lock />}>
      <div className="flex flex-col gap-3">
        <Button variant="secondary" block onClick={onChangePin}>
          <KeyRound /> {t('changePin')}
        </Button>
        <Button variant="secondary" block onClick={lock}>
          <Lock /> {t('lockNow')}
        </Button>
        <Button variant="secondary" block onClick={() => void signOut()}>
          <LogOut /> {t('signOut')}
        </Button>
        <Button
          variant="danger"
          block
          onClick={() => (navigator.onLine ? setConfirmAll(true) : setOfflineMsg(true))}
        >
          <MonitorSmartphone /> {t('signOutAll')}
        </Button>
        {offlineMsg && (
          <p role="alert" className="font-semibold text-danger">
            ⚠️ {t('needsInternet')}
          </p>
        )}
      </div>
      <ConfirmDialog
        open={confirmAll}
        onOpenChange={setConfirmAll}
        title={t('signOutAll')}
        body={t('signOutAllConfirm')}
        danger
        onConfirm={() => void signOutAll()}
      />
    </ArchCard>
  )
}

function Conflicts() {
  const { t } = useI18n()
  const tick = useSyncExternalStore(subscribeOutbox, getConflictTick)
  const [list, setList] = useState<ConflictEntry[]>([])
  useEffect(() => {
    let alive = true
    void listConflicts().then((l) => alive && setList(l))
    return () => {
      alive = false
    }
  }, [tick])

  // Only shown when something needs attention; the red badge in the header links here.
  if (list.length === 0) return null

  return (
    <div id="conflicts">
      <ArchCard title={t('conflicts')} icon={<AlertTriangle />} className="border-2 border-danger">
        {
          <>
            <p className="mb-3">{t('conflictsHelp')}</p>
            <ul className="flex flex-col gap-3">
              {list.map((c) => (
                <li key={c.key} className="rounded-xl border border-line bg-surface-2 p-3">
                  <div className="text-sm text-ink-muted">
                    {c.coll} · {new Date(c.failedAt).toLocaleString('en-IN')} · {c.error}
                  </div>
                  <pre className="mt-1 overflow-x-auto text-sm whitespace-pre-wrap">{JSON.stringify(c.data, null, 2)}</pre>
                  <Button variant="secondary" size="md" className="mt-2" onClick={() => void dismissConflict(c.key)}>
                    {t('dismiss')}
                  </Button>
                </li>
              ))}
            </ul>
          </>
        }
      </ArchCard>
    </div>
  )
}

export function SettingsPage() {
  const { t } = useI18n()
  const { ctx, member } = useSession()
  const isManager = useIsManager()
  const [changingPin, setChangingPin] = useState(false)

  if (changingPin) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-ivory">
        <SetPinScreen
          onPin={(pin) => {
            void savePin(ctx, member as Member, pin)
            setChangingPin(false)
            toast({ message: t('saved') })
          }}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-3xl">{t('settingsTitle')}</h1>
      <Conflicts />
      <Button asChild block>
        <Link to="/backup">
          <ShieldCheck /> {t('bk_title')}
        </Link>
      </Button>
      <ShopDetails />
      <TemplatesEditor />
      <Display />
      {isManager && (
        <Button asChild variant="secondary" block>
          <Link to="/master">
            <Shirt /> {t('master')}
          </Link>
        </Button>
      )}
      {isManager && <Team />}
      <Security onChangePin={() => setChangingPin(true)} />
      {isManager && (
        <Button asChild variant="ghost">
          <Link to="/design">
            <Palette /> Design system
          </Link>
        </Button>
      )}
      <p className="text-center text-sm text-ink-muted">
        {t('version')} {__APP_VERSION__}
      </p>
    </div>
  )
}
