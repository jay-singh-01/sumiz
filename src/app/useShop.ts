import { useSession } from '@/auth/AuthGate'
import { useDoc } from '@/data/hooks'
import { DEFAULT_SETTINGS, type Settings } from '@/data/schemas'
import type { Stored } from '@/data/types'

/** Shop branding and preferences (settings/main), falling back to defaults until synced. */
export function useSettings(): { settings: Settings; doc: Stored<Settings> | null | undefined } {
  const { shopId } = useSession()
  const doc = useDoc<Settings>(`shops/${shopId}/settings/main`)
  return { settings: { ...DEFAULT_SETTINGS, ...(doc ?? {}) }, doc }
}

export function useIsManager(): boolean {
  const { member } = useSession()
  return member.role === 'owner' || member.role === 'admin'
}
