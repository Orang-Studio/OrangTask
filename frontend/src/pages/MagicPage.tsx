import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Logo } from '../components/Logo'
import { t, type MessageKey } from '../lib/i18n'
import { resolveMagicLink } from '../lib/magicLink'

export function MagicPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [copied, setCopied] = useState(false)
  const action = useMemo(() => resolveMagicLink(searchParams), [searchParams])
  const token = action.kind === 'invalid' ? '' : action.token

  useEffect(() => {
    if (action.kind === 'invalid') {
      navigate('/login?error=invalid')
    } else if (action.kind === 'browser') {
      window.location.href = action.verifyUrl
    }
  }, [action, navigate])

  const copyToken = async () => {
    try {
      await navigator.clipboard.writeText(token)
    } catch {
      const input = document.createElement('textarea')
      input.value = token
      input.style.position = 'fixed'
      input.style.opacity = '0'
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      input.remove()
    }
    setCopied(true)
  }

  if (action.kind === 'app') {
    return (
      <div className="min-h-screen flex items-center justify-center px-5 py-10">
        <main className="surface w-full max-w-md p-6 sm:p-8 text-center">
          <Logo size={56} className="mx-auto" />
          <h1 className="mt-5 text-2xl font-bold text-gray-900 dark:text-white">
            {t('magic.openInAndroid' as MessageKey)}
          </h1>
          <p className="mt-3 text-sm leading-6 text-gray-600 dark:text-gray-300">
            {t('magic.androidNotBrowser' as MessageKey)}
          </p>

          <a href={action.appUrl} className="btn-primary w-full mt-6">
            {t('magic.openApp' as MessageKey)}
          </a>

          <p className="mt-6 text-sm leading-6 text-gray-600 dark:text-gray-300">
            {t('magic.copyFallback' as MessageKey)}
          </p>
          <code className="mt-3 block border border-gray-300 dark:border-ink-500 bg-gray-50 dark:bg-ink-750 p-3 text-xs break-all select-all text-gray-800 dark:text-gray-100">
            {token}
          </code>
          <button type="button" onClick={copyToken} className="btn-secondary w-full mt-3">
            {t((copied ? 'magic.copied' : 'magic.copyToken') as MessageKey)}
          </button>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <Logo size={48} />
      <p className="text-sm text-gray-400">{t('magic.signingIn' as MessageKey)}</p>
    </div>
  )
}
