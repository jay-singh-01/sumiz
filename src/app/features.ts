import { useSettings } from './useShop'

/** Extra features (spec §3 "Extras"), each switchable in Settings. Missing = on. */
export const FEATURES = [
  'calendar',
  'tokenSlip',
  'voice',
  'photos',
  'migration',
  'greetings',
  'loyalty',
  'expenses',
  'karigars',
  'materials',
  'dailyNotification',
  'help',
] as const
export type Feature = (typeof FEATURES)[number]

export function useFeatures(): (f: Feature) => boolean {
  const { settings } = useSettings()
  return (f) => settings.features?.[f] ?? true
}
