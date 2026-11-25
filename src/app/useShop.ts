import { useEffect } from 'react'
import { useSession } from '@/auth/AuthGate'
import { useDoc } from '@/data/hooks'
import { DEFAULT_SETTINGS, type Settings } from '@/data/schemas'
import type { Stored } from '@/data/types'

export const BRAND_KEY = 'gd.brand'

/** Shop branding and preferences (settings/main), falling back to defaults until synced. */
export function useSettings(): { settings: Settings; doc: Stored<Settings> | null | undefined } {
  const { shopId } = useSession()
  const doc = useDoc<Settings>(`shops/${shopId}/settings/main`)
  const settings = { ...DEFAULT_SETTINGS, ...(doc ?? {}) }

  // Remembered on the device so the splash screen can show the shop's own name before sign-in.
  const { shopName, subLine, tagline, logoUrl } = settings
  useEffect(() => {
    if (!doc) return
    try {
      localStorage.setItem(BRAND_KEY, JSON.stringify({ shopName, subLine, tagline, logoUrl }))
    } catch {
      // Not remembered; the splash falls back to the default name.
    }
  }, [doc, shopName, subLine, tagline, logoUrl])

  return { settings, doc }
}

export function useIsManager(): boolean {
  const { member } = useSession()
  return member.role === 'owner' || member.role === 'admin'
}
