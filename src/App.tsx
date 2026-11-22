import { useState, useSyncExternalStore } from 'react'
import { AuthGate, useSession } from '@/auth/AuthGate'
import { BigButton, Screen } from '@/auth/ui'
import { getConflictTick, getPendingCount, subscribeOutbox } from '@/data/outbox'
import { LanguageProvider, useI18n } from '@/i18n'

// Phase 2 placeholder home: exercises the session (lock, sign out, sign out
// everywhere). Replaced by the real app shell and home screen in Phase 3.
function Home() {
  const { t } = useI18n()
  const { member, lock, signOut, signOutAll } = useSession()
  const pending = useSyncExternalStore(subscribeOutbox, getPendingCount)
  useSyncExternalStore(subscribeOutbox, getConflictTick)
  const [confirming, setConfirming] = useState(false)

  return (
    <Screen title={t('welcome', { name: member.name })} help={`${t(`role_${member.role}`)} · ${t('phase2Placeholder')}`}>
      <p className="text-base text-ink/70 tabular-nums">sync: {pending === 0 ? '✅' : `🔄 ${pending}`}</p>
      <BigButton variant="secondary" onClick={lock}>
        🔒 {t('lockNow')}
      </BigButton>
      <BigButton variant="secondary" onClick={() => void signOut()}>
        🚪 {t('signOut')}
      </BigButton>
      {!confirming ? (
        <BigButton variant="danger" onClick={() => setConfirming(true)}>
          📵 {t('signOutAll')}
        </BigButton>
      ) : (
        <div className="rounded-2xl border-2 border-red-700 bg-white p-4">
          <p className="mb-3 text-lg">{t('signOutAllConfirm')}</p>
          <div className="grid grid-cols-2 gap-3">
            <BigButton variant="danger" onClick={() => void signOutAll()}>
              {t('yes')}
            </BigButton>
            <BigButton variant="secondary" onClick={() => setConfirming(false)}>
              {t('no')}
            </BigButton>
          </div>
        </div>
      )}
    </Screen>
  )
}

export default function App() {
  return (
    <LanguageProvider>
      <AuthGate>
        <Home />
      </AuthGate>
    </LanguageProvider>
  )
}
