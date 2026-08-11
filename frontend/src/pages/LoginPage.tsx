import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Mail, Github, Lock, ArrowRight, Check, KeyRound } from 'lucide-react'
import { api } from '../lib/api'
import { t, tNodes, type MessageKey } from '../lib/i18n'
import { useAuthStore } from '../stores/auth'
import { Logo } from '../components/Logo'
import { Recaptcha } from '../components/Recaptcha'

type Mode = 'magic' | 'password' | 'register' | 'reset' | 'twoFactor' | 'verifyEmail'

export function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { setUser, setRequiresPin } = useAuthStore()

  const [mode, setMode] = useState<Mode>('magic')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [magicSent, setMagicSent] = useState(false)
  const [resetStep, setResetStep] = useState<'request' | 'confirm'>('request')
  const [resetCode, setResetCode] = useState('')
  const [twoFactorCode, setTwoFactorCode] = useState('')
  const [recaptchaToken, setRecaptchaToken] = useState('')
  const [captchaRequired, setCaptchaRequired] = useState(false)

  const urlError = searchParams.get('error')
  const verification = searchParams.get('verification')

  const openReset = () => {
    setMode('reset')
    setResetStep('request')
    setResetCode('')
    setError('')
  }

  const sendMagic = async () => {
    if (!email.includes('@')) {
      setError(t('login.validEmail' as MessageKey))
      return
    }
    setLoading(true)
    setError('')
    try {
      await api.post('/auth/magic-link', { email })
      setMagicSent(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('login.sendLinkError' as MessageKey))
    } finally {
      setLoading(false)
    }
  }

  const doPassword = async () => {
    setLoading(true)
    setError('')
    try {
      if (mode === 'register') {
        const res = await api.post<{ user?: any; requires_pin?: boolean }>('/auth/register', { email, password, name, recaptcha_token: recaptchaToken })
        if (res.requires_pin) {
          setRequiresPin(true)
          navigate('/pin?next=/today')
        } else {
          setUser(res.user)
          navigate('/today')
        }
      } else {
        const res = await api.post<{ requires_email_2fa?: boolean }>('/auth/login', { email, password, recaptcha_token: recaptchaToken })
        if (res.requires_email_2fa) {
          setTwoFactorCode('')
          setMode('twoFactor')
        }
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : t('login.authError' as MessageKey)
      setError(message)
      if (message.includes('CAPTCHA')) setCaptchaRequired(true)
      if (message.includes('Verify your email')) setMode('verifyEmail')
    } finally {
      setLoading(false)
    }
  }

  const verifyTwoFactor = async () => {
    if (!/^\d{6}$/.test(twoFactorCode)) {
      setError(t('login.codeFromEmail' as MessageKey))
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await api.post<{ user?: any; requires_pin?: boolean }>('/auth/login/2fa/verify', { email, code: twoFactorCode })
      if (res.requires_pin) {
        setRequiresPin(true)
        navigate('/pin?next=/today')
      } else {
        setUser(res.user)
        navigate('/today')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t('login.verifyCodeError' as MessageKey))
    } finally {
      setLoading(false)
    }
  }

  const resendVerification = async () => {
    setLoading(true)
    setError('')
    try {
      await api.post('/auth/resend-verification', { email })
    } catch (e) {
      setError(e instanceof Error ? e.message : t('login.resendVerificationError' as MessageKey))
    } finally {
      setLoading(false)
    }
  }

  const resendTwoFactor = async () => {
    setLoading(true)
    setError('')
    try {
      await api.post('/auth/login/2fa/resend', { email })
    } catch (e) {
      setError(e instanceof Error ? e.message : t('login.resendCodeError' as MessageKey))
    } finally {
      setLoading(false)
    }
  }

  const requestReset = async () => {
    if (!email.includes('@')) {
      setError(t('login.validEmail' as MessageKey))
      return
    }
    setLoading(true)
    setError('')
    try {
      await api.post('/auth/forgot-password', { email })
      setResetStep('confirm')
    } catch (e) {
      setError(e instanceof Error ? e.message : t('login.sendCodeError' as MessageKey))
    } finally {
      setLoading(false)
    }
  }

  const doReset = async () => {
    if (!/^\d{6}$/.test(resetCode)) {
      setError(t('login.codeFromEmail' as MessageKey))
      return
    }
    if (password.length < 8) {
      setError(t('login.passwordMin' as MessageKey))
      return
    }
    setLoading(true)
    setError('')
    try {
      await api.post('/auth/reset-password', { email, code: resetCode, password })

      const res = await api.post<{ user?: any; requires_pin?: boolean }>('/auth/login', { email, password })
      if (res.requires_pin) {
        setRequiresPin(true)
        navigate('/pin?next=/today')
      } else {
        setUser(res.user)
        navigate('/today')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t('login.resetError' as MessageKey))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gray-50 dark:bg-ink-900">
      <div className="w-full max-w-sm">

        <div className="flex flex-col items-center mb-8">
          <Logo size={56} />
          <h1 className="mt-4 text-2xl font-bold uppercase tracking-wider">OrangTask</h1>
          <p className="text-sm text-gray-500 dark:text-ink-400 mt-1">{t('login.tagline' as MessageKey)}</p>
        </div>

        <div className="surface p-6">
          {(urlError || error || verification) && (
            <div className="mb-4 px-3 py-2 bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400 text-sm">
              {error || (verification === 'success' ? t('login.verificationSuccess' as MessageKey) : verification === 'invalid' ? t('login.verificationInvalid' as MessageKey) : urlError === 'expired' ? t('login.linkExpired' as MessageKey) : t('login.signInFailed' as MessageKey))}
            </div>
          )}

          {magicSent ? (
            <div className="text-center py-6">
              <div className="w-12 h-12 mx-auto bg-orange-500 flex items-center justify-center mb-4">
                <Check size={24} className="text-white" strokeWidth={3} />
              </div>
              <h2 className="font-bold mb-1">{t('login.checkYourEmail' as MessageKey)}</h2>
              <p className="text-sm text-gray-500 dark:text-ink-400">
                {tNodes('login.sentLinkTo' as MessageKey, { email: <strong>{email}</strong> })}
              </p>
              <button
                onClick={() => setMagicSent(false)}
                className="mt-4 text-sm text-orange-500 hover:underline"
              >
                {t('login.useDifferentEmail' as MessageKey)}
              </button>
            </div>
          ) : (
            <>
              {mode === 'magic' && (
                <div className="space-y-3">
                  <label className="text-xs uppercase tracking-wide text-gray-400">{t('common.email' as MessageKey)}</label>
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && sendMagic()}
                    type="email"
                    placeholder={t('login.emailPlaceholder' as MessageKey)}
                    className="input-field"
                    autoFocus
                  />
                  <button onClick={sendMagic} disabled={loading} className="btn-primary w-full">
                    <Mail size={16} className="mr-2" />
                    {loading ? t('login.sending' as MessageKey) : t('login.sendMagicLink' as MessageKey)}
                  </button>
                </div>
              )}

              {(mode === 'password' || mode === 'register') && (
                <div className="space-y-3">
                  {mode === 'register' && (
                    <>
                      <label className="text-xs uppercase tracking-wide text-gray-400">{t('common.name' as MessageKey)}</label>
                      <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder={t('login.namePlaceholder' as MessageKey)}
                        className="input-field"
                      />
                    </>
                  )}
                  <label className="text-xs uppercase tracking-wide text-gray-400">{t('common.email' as MessageKey)}</label>
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    type="email"
                    placeholder={t('login.emailPlaceholder' as MessageKey)}
                    className="input-field"
                  />
                  <label className="text-xs uppercase tracking-wide text-gray-400">{t('common.password' as MessageKey)}</label>
                  <input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && doPassword()}
                    type="password"
                    placeholder="••••••••"
                    className="input-field"
                  />
                  <Recaptcha active={mode === 'register' || captchaRequired} onChange={setRecaptchaToken} />
                  <button onClick={doPassword} disabled={loading || ((mode === 'register' || captchaRequired) && !recaptchaToken)} className="btn-primary w-full">
                    <Lock size={16} className="mr-2" />
                    {loading ? t('login.waiting' as MessageKey) : mode === 'register' ? t('login.createAccount' as MessageKey) : t('login.signIn' as MessageKey)}
                  </button>
                </div>
              )}

              {mode === 'reset' && (
                <div className="space-y-3">
                  <p className="text-sm text-gray-500 dark:text-ink-400">
                    {resetStep === 'request'
                      ? t('login.resetInstruction' as MessageKey)
                      : t('login.resetEnterCode' as MessageKey, { email })}
                  </p>
                  <label className="text-xs uppercase tracking-wide text-gray-400">{t('common.email' as MessageKey)}</label>
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && resetStep === 'request' && requestReset()}
                    type="email"
                    placeholder={t('login.emailPlaceholder' as MessageKey)}
                    disabled={resetStep === 'confirm'}
                    className="input-field disabled:opacity-60"
                    autoFocus
                  />
                  {resetStep === 'request' ? (
                    <button onClick={requestReset} disabled={loading} className="btn-primary w-full">
                      <KeyRound size={16} className="mr-2" />
                      {loading ? t('login.sending' as MessageKey) : t('login.sendResetCode' as MessageKey)}
                    </button>
                  ) : (
                    <>
                      <label className="text-xs uppercase tracking-wide text-gray-400">{t('login.resetCode' as MessageKey)}</label>
                      <input
                        value={resetCode}
                        onChange={(e) => setResetCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        inputMode="numeric"
                        placeholder="123456"
                        className="input-field tracking-[0.3em] text-center"
                        autoFocus
                      />
                      <label className="text-xs uppercase tracking-wide text-gray-400">{t('login.newPassword' as MessageKey)}</label>
                      <input
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && doReset()}
                        type="password"
                        placeholder={t('login.passwordHint' as MessageKey)}
                        className="input-field"
                      />
                      <button onClick={doReset} disabled={loading} className="btn-primary w-full">
                        <Lock size={16} className="mr-2" />
                        {loading ? t('login.waiting' as MessageKey) : t('login.resetAndSignIn' as MessageKey)}
                      </button>
                      <button
                        onClick={requestReset}
                        disabled={loading}
                        className="text-xs text-gray-400 hover:text-orange-500"
                      >
                        {t('login.resendCode' as MessageKey)}
                      </button>
                    </>
                  )}
                </div>
              )}

              {mode === 'twoFactor' && (
                <div className="space-y-3 text-center">
                  <h2 className="font-bold">{t('login.checkYourEmail' as MessageKey)}</h2>
                  <p className="text-sm text-gray-500 dark:text-ink-400">{tNodes('login.sentCodeTo' as MessageKey, { email: <strong>{email}</strong> })}</p>
                  <input
                    value={twoFactorCode}
                    onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    onKeyDown={(e) => e.key === 'Enter' && verifyTwoFactor()}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="123456"
                    className="input-field tracking-[0.3em] text-center"
                    autoFocus
                  />
                  <button onClick={verifyTwoFactor} disabled={loading} className="btn-primary w-full">
                    <Lock size={16} className="mr-2" /> {loading ? t('login.verifying' as MessageKey) : t('login.verifyAndSignIn' as MessageKey)}
                  </button>
                  <button onClick={resendTwoFactor} disabled={loading} className="text-xs text-gray-400 hover:text-orange-500">{t('login.resendCode' as MessageKey)}</button>
                </div>
              )}

              {mode === 'verifyEmail' && (
                <div className="space-y-3 text-center">
                  <div className="w-12 h-12 mx-auto bg-orange-500 flex items-center justify-center"><Mail size={24} className="text-white" /></div>
                  <h2 className="font-bold">{t('login.checkYourEmail' as MessageKey)}</h2>
                  <p className="text-sm text-gray-500 dark:text-ink-400">{tNodes('login.sentVerificationTo' as MessageKey, { email: <strong>{email}</strong> })}</p>
                  <button onClick={resendVerification} disabled={loading} className="btn-secondary w-full">{loading ? t('login.sending' as MessageKey) : t('login.resendVerification' as MessageKey)}</button>
                  <button onClick={() => setMode('password')} className="text-xs text-gray-400 hover:text-orange-500">{t('login.backToSignIn' as MessageKey)}</button>
                </div>
              )}

              {(mode === 'magic' || mode === 'password' || mode === 'register') && (
                <>
                  <div className="flex items-center gap-3 my-5">
                    <div className="flex-1 h-px bg-gray-200 dark:bg-ink-600" />
                    <span className="text-xs text-gray-400 uppercase">{t('login.or' as MessageKey)}</span>
                    <div className="flex-1 h-px bg-gray-200 dark:bg-ink-600" />
                  </div>

                  <div className="space-y-2">
                    <a href="/api/auth/github" className="btn-secondary w-full">
                      <Github size={16} className="mr-2" /> {t('login.continueWithGithub' as MessageKey)}
                    </a>
                    <a href="/api/auth/google" className="btn-secondary w-full">
                      <svg className="mr-2" width="16" height="16" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                      {t('login.continueWithGoogle' as MessageKey)}
                    </a>
                  </div>
                </>
              )}

              <div className="mt-5 text-center text-sm space-y-1">
                {mode === 'magic' && (
                  <button onClick={() => setMode('password')} className="text-gray-500 dark:text-ink-400 hover:text-orange-500">
                    {t('login.usePasswordInstead' as MessageKey)}
                  </button>
                )}
                {mode === 'password' && (
                  <div className="space-y-2">
                    <div className="space-x-3">
                      <button onClick={() => setMode('magic')} className="text-gray-500 dark:text-ink-400 hover:text-orange-500">
                        {t('login.magicLink' as MessageKey)}
                      </button>
                      <button onClick={() => setMode('register')} className="text-orange-500 hover:underline inline-flex items-center gap-1">
                        {t('login.createAccount' as MessageKey)} <ArrowRight size={13} />
                      </button>
                    </div>
                    <button onClick={openReset} className="block w-full text-gray-400 hover:text-orange-500">
                      {t('login.forgotPassword' as MessageKey)}
                    </button>
                  </div>
                )}
                {mode === 'register' && (
                  <button onClick={() => setMode('password')} className="text-gray-500 dark:text-ink-400 hover:text-orange-500">
                    {t('login.haveAccountSignIn' as MessageKey)}
                  </button>
                )}
                {mode === 'reset' && (
                  <button onClick={() => { setMode('password'); setError('') }} className="text-gray-500 dark:text-ink-400 hover:text-orange-500">
                    {t('login.backToSignIn' as MessageKey)}
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          {t('login.freeOpenSource' as MessageKey)}
        </p>
        <p className="text-center text-xs text-gray-400 mt-2">
          <a href="/legal" className="hover:text-orange-500 underline">{t('login.termsPrivacy' as MessageKey)}</a>
        </p>
      </div>
    </div>
  )
}
