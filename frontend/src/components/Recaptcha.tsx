import { useEffect, useRef } from 'react'

declare global {
  interface Window {
    grecaptcha?: {
      render: (container: HTMLElement, options: { sitekey: string; callback: (token: string) => void; 'expired-callback': () => void }) => number
      reset: (widgetId?: number) => void
    }
  }
}

const SCRIPT_ID = 'google-recaptcha-v2'

function loadRecaptcha(): Promise<void> {
  if (window.grecaptcha) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('Failed to load CAPTCHA')), { once: true })
      return
    }
    const script = document.createElement('script')
    script.id = SCRIPT_ID
    script.src = 'https://www.google.com/recaptcha/api.js?render=explicit'
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load CAPTCHA'))
    document.head.appendChild(script)
  })
}

export function Recaptcha({ active, onChange }: { active: boolean; onChange: (token: string) => void }) {
  const container = useRef<HTMLDivElement>(null)
  const widgetId = useRef<number | null>(null)
  const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY as string | undefined

  useEffect(() => {
    if (!active) return
    onChange('')
    if (!siteKey || !container.current) return
    loadRecaptcha()
      .then(() => {
        if (!container.current || widgetId.current !== null || !window.grecaptcha) return
        widgetId.current = window.grecaptcha.render(container.current, {
          sitekey: siteKey,
          callback: onChange,
          'expired-callback': () => onChange(''),
        })
      })
      .catch(() => onChange(''))
  }, [active, onChange, siteKey])

  if (!active) return null
  if (!siteKey) return <p className="text-xs text-red-600">CAPTCHA is not configured. Contact the site administrator.</p>
  return <div ref={container} className="flex justify-center py-1" />
}
