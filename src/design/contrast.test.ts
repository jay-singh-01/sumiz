// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// WCAG AA check for every text/background pairing the UI uses, in both themes.
// Parses the real tokens from src/index.css so the two can't drift apart.

function block(css: string, selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`)
  const body = css.slice(start, css.indexOf('}', start))
  return Object.fromEntries([...body.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2]]))
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const css = readFileSync('src/index.css', 'utf8')
const themes = { light: block(css, '.theme-light'), dark: block(css, '[data-theme="dark"]') }

// [foreground, background]
const pairs: [string, string][] = [
  ['ink', 'ivory'],
  ['ink', 'surface'],
  ['ink', 'surface-2'],
  ['ink-muted', 'ivory'],
  ['ink-muted', 'surface'],
  ['rani', 'ivory'],
  ['rani', 'surface'],
  ['indigo', 'ivory'],
  ['indigo', 'surface'],
  ['emerald', 'surface'],
  ['danger', 'surface'],
  ['gold-deep', 'surface'],
  ['gold-deep', 'ivory'],
  ['on-rani', 'rani'],
  ['on-rani', 'rani-deep'],
  ['on-indigo', 'indigo'],
  ['on-emerald', 'emerald'],
  ['on-marigold', 'marigold'],
  ['on-danger', 'danger'],
]

describe.each(Object.entries(themes))('%s theme', (_name, tokens) => {
  it.each(pairs)('%s on %s meets AA (4.5:1)', (fg, bg) => {
    expect(tokens[fg], fg).toBeDefined()
    expect(tokens[bg], bg).toBeDefined()
    expect(contrast(tokens[fg], tokens[bg])).toBeGreaterThanOrEqual(4.5)
  })
})
