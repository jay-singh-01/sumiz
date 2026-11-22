// Gentle vibration feedback on Android. Silently does nothing elsewhere.
const patterns = {
  tap: 12,
  success: [20, 40, 30],
  error: [60, 40, 60],
} as const

export function haptic(kind: keyof typeof patterns = 'tap'): void {
  try {
    navigator.vibrate?.(patterns[kind] as number | number[])
  } catch {
    // Not supported.
  }
}
