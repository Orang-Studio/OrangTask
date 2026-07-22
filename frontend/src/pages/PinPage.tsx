import { useState, useRef, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuthStore } from '../stores/auth'
import { Logo } from '../components/Logo'
import { useHaptics } from '../hooks/useHaptics'

// optional PIN gate Reached on app startup (and after login) when a user has a PIN set Accepts a 4-6
export function PinPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { fetchMe, setRequiresPin } = useAuthStore()
  const haptics = useHaptics()

  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // forgot-PIN recovery: 'idle' = normal entry, 'sent' = enter emailed code
  const [recover, setRecover] = useState<'idle' | 'sent'>('idle')
  const [code, setCode] = useState('')
  const [recoverMsg, setRecoverMsg] = useState('')
  const [recoverErr, setRecoverErr] = useState('')
  const [recoverBusy, setRecoverBusy] = useState(false)

  const next = searchParams.get('next') || '/today'

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const onChange = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 6)
    setPin(digits)
    setError(false)
    // a 6-digit PIN is unambiguous, so submit automatically; 4-5 use Unlock/Enter
    if (digits.length === 6) verify(digits)
  }

  const verify = async (value: string) => {
    if (value.length < 4 || submitting) return
    setSubmitting(true)
    try {
      await api.post('/auth/pin/verify', { pin: value })
      haptics.success()
      setRequiresPin(false)
      await fetchMe()
      navigate(next)
    } catch {
      haptics.error()
      setError(true)
      setPin('')
      inputRef.current?.focus()
    } finally {
      setSubmitting(false)
    }
  }

  const requestPinReset = async () => {
    setRecoverBusy(true)
    setRecoverErr('')
    try {
      await api.post('/auth/pin/forgot')
      setRecover('sent')
      setRecoverMsg('We emailed a reset code to your account address.')
    } catch (e) {
      setRecoverErr(e instanceof Error ? e.message : 'Could not send a reset code')
    } finally {
      setRecoverBusy(false)
    }
  }

  const submitPinReset = async () => {
    if (!/^\d{6}$/.test(code)) {
      setRecoverErr('Enter the 6-digit code from your email')
      return
    }
    setRecoverBusy(true)
    setRecoverErr('')
    try {
      await api.post('/auth/pin/reset', { code })
      haptics.success()
      // PIN removed; this session is unlocked
      setRequiresPin(false)
      await fetchMe()
      navigate(next)
    } catch (e) {
      haptics.error()
      setRecoverErr(e instanceof Error ? e.message : 'Could not reset PIN')
    } finally {
      setRecoverBusy(false)
    }
  }

  if (recover !== 'idle') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-gray-50 dark:bg-ink-900">
        <div className="w-full max-w-sm text-center">
          <div className="flex flex-col items-center mb-8">
            <Logo size={48} />
            <h1 className="mt-4 text-xl font-bold uppercase tracking-wider">Reset your PIN</h1>
            <p className="text-sm text-gray-500 dark:text-ink-400 mt-1">{recoverMsg}</p>
          </div>

          <input
            value={code}
            onChange={(e) => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setRecoverErr('') }}
            onKeyDown={(e) => { if (e.key === 'Enter') submitPinReset() }}
            inputMode="numeric"
            autoFocus
            placeholder="123456"
            className="w-full h-16 text-center text-3xl font-bold tracking-[0.4em] bg-white dark:bg-ink-750 border-2 border-gray-300 dark:border-ink-500 focus:border-orange-500 outline-none transition-colors"
          />

          {recoverErr && <p className="text-sm text-red-500 mt-4">{recoverErr}</p>}

          <button
            onClick={submitPinReset}
            disabled={code.length !== 6 || recoverBusy}
            className="btn-primary w-full mt-6 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {recoverBusy ? 'Please wait…' : 'Remove PIN & continue'}
          </button>

          <button onClick={requestPinReset} disabled={recoverBusy} className="mt-4 text-sm text-gray-400 hover:text-orange-500">
            Resend code
          </button>
          <button
            onClick={() => { setRecover('idle'); setCode(''); setRecoverErr(''); inputRef.current?.focus() }}
            className="block mx-auto mt-3 text-sm text-gray-400 hover:text-orange-500"
          >
            Back to PIN entry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gray-50 dark:bg-ink-900">
      <div className="w-full max-w-sm text-center">
        <div className="flex flex-col items-center mb-8">
          <Logo size={48} />
          <h1 className="mt-4 text-xl font-bold uppercase tracking-wider">Enter your PIN</h1>
          <p className="text-sm text-gray-500 dark:text-ink-400 mt-1">Unlock your tasks</p>
        </div>

        {/* type=text + CSS mask (not type=password) so the browsers saved-passwords menu never pops up */}
        <input
          ref={inputRef}
          value={pin}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') verify(pin) }}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          maxLength={6}
          name="pin-code"
          data-1p-ignore="true"
          data-lpignore="true"
          aria-label="PIN"
          placeholder="••••"
          className={`pin-mask w-full h-16 text-center text-3xl font-bold tracking-[0.5em] bg-white dark:bg-ink-750 border-2 outline-none transition-colors ${
            error ? 'border-red-500 animate-pulse' : 'border-gray-300 dark:border-ink-500 focus:border-orange-500'
          }`}
        />

        {error && <p className="text-sm text-red-500 mt-4">Wrong PIN, try again</p>}

        <button
          onClick={() => verify(pin)}
          disabled={pin.length < 4 || submitting}
          className="btn-primary w-full mt-6 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Unlock
        </button>

        <button
          onClick={requestPinReset}
          disabled={recoverBusy}
          className="mt-6 block mx-auto text-sm text-gray-400 hover:text-orange-500 disabled:opacity-50"
        >
          {recoverBusy ? 'Sending reset code…' : 'Forgot PIN?'}
        </button>
        {recoverErr && <p className="text-sm text-red-500 mt-2">{recoverErr}</p>}

        <button
          onClick={() => {
            useAuthStore.getState().logout()
            navigate('/login')
          }}
          className="mt-4 block mx-auto text-sm text-gray-400 hover:text-orange-500"
        >
          Sign out instead
        </button>
      </div>
    </div>
  )
}
