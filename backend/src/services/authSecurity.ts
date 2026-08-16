export const CAPTCHA_AFTER_FAILED_LOGINS = 2

export function isCaptchaRequired(failedAttempts: number): boolean {
  return failedAttempts >= CAPTCHA_AFTER_FAILED_LOGINS
}

export function loginFailureCacheKey(email: string): string {
  return `auth:login-fail:${email.trim().toLowerCase()}`
}

export function isVerificationCode(code: unknown): code is string {
  return typeof code === 'string' && /^\d{6}$/.test(code)
}

export async function verifyRecaptcha(token: unknown, remoteIp?: string): Promise<boolean> {
  const secret = process.env.RECAPTCHA_SECRET_KEY
  if (!secret || typeof token !== 'string' || !token) return false

  const body = new URLSearchParams({ secret, response: token })
  if (remoteIp) body.set('remoteip', remoteIp)

  try {
    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })
    const result = await response.json() as { success?: boolean }
    return response.ok && result.success === true
  } catch {
    return false
  }
}