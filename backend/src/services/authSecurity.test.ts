import { describe, expect, test } from 'bun:test'
import {
  CAPTCHA_AFTER_FAILED_LOGINS,
  isCaptchaRequired,
  isVerificationCode,
  loginFailureCacheKey,
} from './authSecurity.js'

describe('login CAPTCHA policy', () => {
  test('requires CAPTCHA starting with the third password attempt after two failures', () => {
    expect(CAPTCHA_AFTER_FAILED_LOGINS).toBe(2)
    expect(isCaptchaRequired(0)).toBe(false)
    expect(isCaptchaRequired(1)).toBe(false)
    expect(isCaptchaRequired(2)).toBe(true)
  })

  test('uses a normalized email in the per-account failure key', () => {
    expect(loginFailureCacheKey('  USER@Example.COM ')).toBe('auth:login-fail:user@example.com')
  })
})

describe('email authentication codes', () => {
  test('accepts exactly six numeric digits', () => {
    expect(isVerificationCode('000001')).toBe(true)
    expect(isVerificationCode('123456')).toBe(true)
  })

  test('rejects malformed codes', () => {
    expect(isVerificationCode('12345')).toBe(false)
    expect(isVerificationCode('1234567')).toBe(false)
    expect(isVerificationCode('12ab56')).toBe(false)
  })
})
