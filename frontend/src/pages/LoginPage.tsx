import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Mail, Github, Lock, ArrowRight, Check, KeyRound } from 'lucide-react'
import { api } from '../lib/api'
import { useAuthStore } from '../stores/auth'
import { Logo } from '../components/Logo'

type Mode = 'magic' | 'password' | 'register' | 'reset'

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

  const urlError = searchParams.get('error')

  const openReset = () => {
    setMode('reset')
    setResetStep('request')
    setResetCode('')
    setError('')
  }

  const sendMagic = async () => {
    if (!email.includes('@')) {
      setError('Enter a valid email')
      return
    }
    setLoading(true)
    setError('')
    try {
      await api.post('/auth/magic-link', { email })
      setMagicSent(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send link')
    } finally {
      setLoading(false)
    }
  }

  const doPassword = async () => {
    setLoading(true)
    setError('')
    try {
      if (mode === 'register') {
        const { user } = await api.post<{ user: any }>('/auth/register', { email, password, name })
        setUser(user)
        navigate('/today')
      } else {
        const res = await api.post<{ user?: any; requires_pin?: boolean }>('/auth/login', { email, password })
        if (res.requires_pin) {
          setRequiresPin(true)
          navigate('/pin?next=/today')
        } else {
          setUser(res.user)
          navigate('/today')
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  const requestReset = async () => {
    if (!email.includes('@')) {
      setError('Enter a valid email')
      return
    }
    setLoading(true)
    setError('')
    try {
      await api.post('/auth/forgot-password', { email })
      setResetStep('confirm')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send code')
    } finally {
      setLoading(false)
    }
  }

  const doReset = async () => {
    if (!/^\d{6}$/.test(resetCode)) {
      setError('Enter the 6-digit code from your email')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    setLoading(true)
    setError('')
    try {
      await api.post('/auth/reset-password', { email, code: resetCode, password })
      // reset succeeded - sign straight in with the new password
      const res = await api.post<{ user?: any; requires_pin?: boolean }>('/auth/login', { email, password })
      if (res.requires_pin) {
        setRequiresPin(true)
        navigate('/pin?next=/today')
      } else {
        setUser(res.user)
        navigate('/today')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not reset password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gray-50 dark:bg-ink-900">
      <div className="w-full max-w-sm">
        {/* brand */}
        <div className="flex flex-col items-center mb-8">
          <Logo size={56} />
          <h1 className="mt-4 text-2xl font-bold uppercase tracking-wider">OrangTask</h1>
          <p className="text-sm text-gray-500 dark:text-ink-400 mt-1">Tasks that sync everywhere</p>
        </div>

        <div className="surface p-6">
          {(urlError || error) && (
            <div className="mb-4 px-3 py-2 bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400 text-sm">
              {error || (urlError === 'expired' ? 'Link expired, request a new one' : 'Sign in failed, try again')}
            </div>
          )}

          {magicSent ? (
            <div className="text-center py-6">
              <div className="w-12 h-12 mx-auto bg-orange-500 flex items-center justify-center mb-4">
                <Check size={24} className="text-white" strokeWidth={3} />
              </div>
              <h2 className="font-bold mb-1">Check your email</h2>
              <p className="text-sm text-gray-500 dark:text-ink-400">
                We sent a sign-in link to <strong>{email}</strong>
              </p>
              <button
                onClick={() => setMagicSent(false)}
                className="mt-4 text-sm text-orange-500 hover:underline"
              >
                Use a different email
              </button>
            </div>
          ) : (
            <>
              {mode === 'magic' && (
                <div className="space-y-3">
                  <label className="text-xs uppercase tracking-wide text-gray-400">Email</label>
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && sendMagic()}
                    type="email"
                    placeholder="you@example.com"
                    className="input-field"
                    autoFocus
                  />
                  <button onClick={sendMagic} disabled={loading} className="btn-primary w-full">
                    <Mail size={16} className="mr-2" />
                    {loading ? 'Sending...' : 'Send magic link'}
                  </button>
                </div>
              )}

              {(mode === 'password' || mode === 'register') && (
                <div className="space-y-3">
                  {mode === 'register' && (
                    <>
                      <label className="text-xs uppercase tracking-wide text-gray-400">Name</label>
                      <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Your name"
                        className="input-field"
                      />
                    </>
                  )}
                  <label className="text-xs uppercase tracking-wide text-gray-400">Email</label>
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    type="email"
                    placeholder="you@example.com"
                    className="input-field"
                  />
                  <label className="text-xs uppercase tracking-wide text-gray-400">Password</label>
                  <input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && doPassword()}
                    type="password"
                    placeholder="••••••••"
                    className="input-field"
                  />
                  <button onClick={doPassword} disabled={loading} className="btn-primary w-full">
                    <Lock size={16} className="mr-2" />
                    {loading ? 'Please wait...' : mode === 'register' ? 'Create account' : 'Sign in'}
                  </button>
                </div>
              )}

              {mode === 'reset' && (
                <div className="space-y-3">
                  <p className="text-sm text-gray-500 dark:text-ink-400">
                    {resetStep === 'request'
                      ? 'Enter your email and we’ll send you a 6-digit code to reset your password.'
                      : `Enter the code we sent to ${email} and choose a new password.`}
                  </p>
                  <label className="text-xs uppercase tracking-wide text-gray-400">Email</label>
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && resetStep === 'request' && requestReset()}
                    type="email"
                    placeholder="you@example.com"
                    disabled={resetStep === 'confirm'}
                    className="input-field disabled:opacity-60"
                    autoFocus
                  />
                  {resetStep === 'request' ? (
                    <button onClick={requestReset} disabled={loading} className="btn-primary w-full">
                      <KeyRound size={16} className="mr-2" />
                      {loading ? 'Sending...' : 'Send reset code'}
                    </button>
                  ) : (
                    <>
                      <label className="text-xs uppercase tracking-wide text-gray-400">Reset code</label>
                      <input
                        value={resetCode}
                        onChange={(e) => setResetCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        inputMode="numeric"
                        placeholder="123456"
                        className="input-field tracking-[0.3em] text-center"
                        autoFocus
                      />
                      <label className="text-xs uppercase tracking-wide text-gray-400">New password</label>
                      <input
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && doReset()}
                        type="password"
                        placeholder="At least 8 characters"
                        className="input-field"
                      />
                      <button onClick={doReset} disabled={loading} className="btn-primary w-full">
                        <Lock size={16} className="mr-2" />
                        {loading ? 'Please wait...' : 'Reset password & sign in'}
                      </button>
                      <button
                        onClick={requestReset}
                        disabled={loading}
                        className="text-xs text-gray-400 hover:text-orange-500"
                      >
                        Resend code
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* divider + OAuth (not shown during password reset) */}
              {mode !== 'reset' && (
                <>
                  <div className="flex items-center gap-3 my-5">
                    <div className="flex-1 h-px bg-gray-200 dark:bg-ink-600" />
                    <span className="text-xs text-gray-400 uppercase">or</span>
                    <div className="flex-1 h-px bg-gray-200 dark:bg-ink-600" />
                  </div>

                  <div className="space-y-2">
                    <a href="/api/auth/github" className="btn-secondary w-full">
                      <Github size={16} className="mr-2" /> Continue with GitHub
                    </a>
                    <a href="/api/auth/google" className="btn-secondary w-full">
                      <svg className="mr-2" width="16" height="16" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                      Continue with Google
                    </a>
                  </div>
                </>
              )}

              {/* mode toggles */}
              <div className="mt-5 text-center text-sm space-y-1">
                {mode === 'magic' && (
                  <button onClick={() => setMode('password')} className="text-gray-500 dark:text-ink-400 hover:text-orange-500">
                    Use password instead
                  </button>
                )}
                {mode === 'password' && (
                  <div className="space-y-2">
                    <div className="space-x-3">
                      <button onClick={() => setMode('magic')} className="text-gray-500 dark:text-ink-400 hover:text-orange-500">
                        Magic link
                      </button>
                      <button onClick={() => setMode('register')} className="text-orange-500 hover:underline inline-flex items-center gap-1">
                        Create account <ArrowRight size={13} />
                      </button>
                    </div>
                    <button onClick={openReset} className="block w-full text-gray-400 hover:text-orange-500">
                      Forgot password?
                    </button>
                  </div>
                )}
                {mode === 'register' && (
                  <button onClick={() => setMode('password')} className="text-gray-500 dark:text-ink-400 hover:text-orange-500">
                    Already have an account? Sign in
                  </button>
                )}
                {mode === 'reset' && (
                  <button onClick={() => { setMode('password'); setError('') }} className="text-gray-500 dark:text-ink-400 hover:text-orange-500">
                    Back to sign in
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Free and open source. Self-host it yourself.
        </p>
        <p className="text-center text-xs text-gray-400 mt-2">
          <a href="/legal" className="hover:text-orange-500 underline">Terms &amp; Privacy</a>
        </p>
      </div>
    </div>
  )
}
