import { describe, expect, it } from 'vitest'
import { describeDevice } from './device'

describe('describeDevice', () => {
  it.each([
    ['Mozilla/5.0 (Linux; Android 14; SM-A145F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36', 'Android · Chrome'],
    ['Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0 Mobile Safari/537.36', 'Android · Samsung Internet'],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36 Edg/131.0', 'Windows · Edge'],
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1', 'iPhone/iPad · Safari'],
    ['', 'Unknown · Browser'],
  ])('%s', (ua, label) => {
    expect(describeDevice(ua)).toBe(label)
  })
})
