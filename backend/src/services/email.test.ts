import { describe, expect, test } from 'bun:test'
import { buildMagicLinkUrl } from './email.js'

describe('buildMagicLinkUrl', () => {
  test('keeps browser magic links on the web flow', () => {
    expect(buildMagicLinkUrl('https://task.oranges.lt', 'abc123', 'web'))
      .toBe('https://task.oranges.lt/auth/magic?token=abc123')
  })

  test('marks Android magic links so the browser cannot consume them', () => {
    expect(buildMagicLinkUrl('https://task.oranges.lt', 'abc123', 'android'))
      .toBe('https://task.oranges.lt/auth/magic?token=abc123&platform=android')
  })

  test('marks desktop magic links with their own platform', () => {
    expect(buildMagicLinkUrl('https://task.oranges.lt', 'abc123', 'desktop'))
      .toBe('https://task.oranges.lt/auth/magic?token=abc123&platform=desktop')
  })
})
