import { describe, expect, test } from 'vitest'
import { resolveMagicLink } from './magicLink'

describe('resolveMagicLink', () => {
  test('keeps a normal web request on browser verification', () => {
    expect(resolveMagicLink(new URLSearchParams('token=abc123'))).toEqual({
      kind: 'browser',
      token: 'abc123',
      verifyUrl: '/api/auth/magic-link/verify?token=abc123',
    })
  })

  test('never sends an Android request to browser verification', () => {
    expect(resolveMagicLink(new URLSearchParams('token=abc123&platform=android'))).toEqual({
      kind: 'app',
      token: 'abc123',
      appUrl: 'orangtask://magic-link?token=abc123',
    })
  })

  test('hands desktop requests to the app too', () => {
    expect(resolveMagicLink(new URLSearchParams('token=abc123&platform=desktop'))).toMatchObject({ kind: 'app' })
  })

  test('rejects a missing token', () => {
    expect(resolveMagicLink(new URLSearchParams('platform=android'))).toEqual({ kind: 'invalid' })
  })
})
