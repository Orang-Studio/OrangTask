import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft, User, Palette, Bell, Webhook, Plug, Database,
  Download, Upload, Trash2, Lock, Monitor, Moon, Sun, Check, ExternalLink,
  Github, Link2, Unlink, LogOut, FileText, Copy, X, Plus,
} from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { unzipSync } from 'fflate'
import { useAuthStore } from '../stores/auth'
import { useTheme } from '../hooks/useTheme'
import { WebhookManager } from '../components/WebhookManager'
import { useApiKeys, useCreateApiKey, useDeleteApiKey } from '../hooks/useApiKeys'
import { api } from '../lib/api'
import { formatDueDate } from '../lib/date'
import { getPushState, enablePush, disablePush, sendTestPush, showLocalTestNotification, type PushState } from '../lib/push'
import { useHaptics } from '../hooks/useHaptics'

type Section = 'profile' | 'appearance' | 'notifications' | 'webhooks' | 'integrations' | 'data' | 'legal'

const SECTIONS: { id: Section; label: string; icon: typeof User }[] = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'webhooks', label: 'Webhooks', icon: Webhook },
  { id: 'integrations', label: 'Integrations', icon: Plug },
  { id: 'data', label: 'Data', icon: Database },
  { id: 'legal', label: 'Legal', icon: FileText },
]

export function SettingsPage() {
  const navigate = useNavigate()
  const { user, setUser, logout } = useAuthStore()
  const { theme, setTheme } = useTheme()
  const haptics = useHaptics()
  const [section, setSection] = useState<Section>('profile')

  return (
    <div className="h-full flex flex-col md:flex-row max-w-4xl mx-auto w-full">
      {/* section nav */}
      <div className="md:w-52 flex-shrink-0 border-b md:border-b-0 md:border-r border-gray-200 dark:border-ink-700">
        <div className="flex items-center gap-2 px-4 h-14 border-b border-gray-200 dark:border-ink-700">
          <button onClick={() => navigate(-1)} className="p-1 text-gray-400">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-lg font-bold uppercase tracking-wide">Settings</h1>
        </div>
        <nav className="flex md:flex-col overflow-x-auto md:overflow-visible p-2 gap-1 no-scrollbar">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => { haptics.tap(); setSection(s.id) }}
              className={`flex items-center gap-2 px-3 h-10 text-sm font-medium whitespace-nowrap transition-colors ${
                section === s.id
                  ? 'bg-orange-50 dark:bg-ink-750 text-orange-600 dark:text-orange-400'
                  : 'text-gray-600 dark:text-ink-300 hover:bg-gray-50 dark:hover:bg-ink-750'
              }`}
            >
              <s.icon size={16} /> {s.label}
            </button>
          ))}
        </nav>
      </div>

      {/* section content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-20">
        {section === 'profile' && <ProfileSection user={user} setUser={setUser} />}
        {section === 'appearance' && (
          <div className="max-w-md space-y-4">
            <SectionTitle title="Appearance" />
            <div>
              <label className="text-xs uppercase tracking-wide text-gray-400 mb-2 block">Theme</label>
              <div className="grid grid-cols-3 gap-2">
                {([['light', Sun], ['dark', Moon], ['system', Monitor]] as const).map(([t, Icon]) => (
                  <button
                    key={t}
                    onClick={() => { haptics.tap(); setTheme(t) }}
                    className={`flex flex-col items-center gap-2 p-4 border transition-colors ${
                      theme === t ? 'border-orange-500 bg-orange-50 dark:bg-ink-750' : 'border-gray-300 dark:border-ink-600'
                    }`}
                  >
                    <Icon size={20} />
                    <span className="text-sm capitalize">{t}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        {section === 'notifications' && <NotificationsSection />}
        {section === 'webhooks' && (
          <div className="max-w-2xl">
            <SectionTitle title="Webhooks" />
            <p className="text-sm text-gray-500 dark:text-ink-400 mb-4">
              Send task events to external services, or create tasks from incoming requests.
            </p>
            <WebhookManager />
          </div>
        )}
        {section === 'integrations' && <IntegrationsSection />}
        {section === 'data' && <DataSection user={user} logout={logout} />}
        {section === 'legal' && <LegalSection />}
      </div>
    </div>
  )
}

function SectionTitle({ title }: { title: string }) {
  return <h2 className="text-base font-bold uppercase tracking-wide mb-4">{title}</h2>
}

function ProfileSection({ user, setUser }: { user: any; setUser: (u: any) => void }) {
  const { logout } = useAuthStore()
  const navigate = useNavigate()
  const [name, setName] = useState(user?.name || '')
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || '')
  const [saved, setSaved] = useState(false)
  const [hasPin, setHasPin] = useState(false)
  const [pinInput, setPinInput] = useState('')
  const [showPinForm, setShowPinForm] = useState(false)
  const haptics = useHaptics()

  const signOut = async () => {
    haptics.tap()
    await logout()
    navigate('/login')
  }

  useEffect(() => {
    api.get<{ has_pin: boolean }>('/user/pin/status').then((d) => setHasPin(d.has_pin)).catch(() => {})
  }, [])

  const save = async () => {
    const { user: updated } = await api.patch<{ user: any }>('/user', { name, avatar_url: avatarUrl })
    setUser(updated)
    haptics.success()
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const setPin = async () => {
    if (!/^\d{4,6}$/.test(pinInput)) return
    await api.post('/user/pin', { pin: pinInput })
    haptics.success()
    setHasPin(true)
    setPinInput('')
    setShowPinForm(false)
  }

  const removePin = async () => {
    await api.delete('/user/pin')
    setHasPin(false)
  }

  return (
    <div className="max-w-md space-y-4">
      <SectionTitle title="Profile" />
      <div className="flex items-center gap-4">
        {avatarUrl ? (
          <img src={avatarUrl} className="w-16 h-16 rounded-full object-cover" alt="" />
        ) : (
          <div className="w-16 h-16 rounded-full bg-orange-500 flex items-center justify-center text-white text-2xl font-bold">
            {name?.[0]?.toUpperCase()}
          </div>
        )}
        <div className="text-sm text-gray-500 dark:text-ink-400">{user?.email}</div>
      </div>

      <div>
        <label className="text-xs uppercase tracking-wide text-gray-400 mb-1 block">Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} className="input-field" />
      </div>
      <div>
        <label className="text-xs uppercase tracking-wide text-gray-400 mb-1 block">Avatar URL</label>
        <input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://..." className="input-field" />
      </div>
      <button onClick={save} className="btn-primary">
        {saved ? <><Check size={16} className="mr-2" /> Saved</> : 'Save profile'}
      </button>

      {}
      <div className="pt-4 border-t border-gray-200 dark:border-ink-700">
        <div className="flex items-center gap-2 mb-2">
          <Lock size={16} className="text-gray-400" />
          <span className="text-sm font-medium">App PIN</span>
          {hasPin && <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400 rounded">Enabled</span>}
        </div>
        <p className="text-sm text-gray-500 dark:text-ink-400 mb-2">
          Optional. Require a 4-6 digit PIN to open the app on this account.
        </p>
        {hasPin ? (
          <button onClick={removePin} className="btn-secondary text-sm">Remove PIN</button>
        ) : showPinForm ? (
          <div className="flex gap-2">
            <input
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
              type="password"
              inputMode="numeric"
              placeholder="4-6 digits"
              className="input-field w-32"
            />
            <button onClick={setPin} className="btn-primary">Set PIN</button>
          </div>
        ) : (
          <button onClick={() => setShowPinForm(true)} className="btn-secondary text-sm">Set up PIN</button>
        )}
      </div>

      <ConnectedAccounts />

      <div className="pt-4 border-t border-gray-200 dark:border-ink-700">
        <button onClick={signOut} className="btn-secondary text-sm inline-flex items-center gap-2">
          <LogOut size={16} /> Sign out
        </button>
      </div>
    </div>
  )
}

const PROVIDER_LABEL: Record<string, string> = { github: 'GitHub', google: 'Google' }

function GoogleGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  )
}

type LinkedData = { accounts: { provider: string; provider_email?: string | null }[]; has_password: boolean }

function ConnectedAccounts() {
  const haptics = useHaptics()
  const [searchParams, setSearchParams] = useSearchParams()
  const [data, setData] = useState<LinkedData | null>(null)
  const [providers, setProviders] = useState<{ github: boolean; google: boolean }>({ github: false, google: false })
  const [banner, setBanner] = useState('')
  const [busy, setBusy] = useState('')

  const load = () => api.get<LinkedData>('/auth/linked').then(setData).catch(() => {})

  useEffect(() => {
    load()
    api.get<{ github: boolean; google: boolean }>('/auth/providers').then(setProviders).catch(() => {})

    // surface the result of a connect round-trip, then clean the URL
    const linked = searchParams.get('linked')
    const err = searchParams.get('link_error')
    if (linked) setBanner(`Connected your ${PROVIDER_LABEL[linked] || linked} account.`)
    else if (err === 'in_use') setBanner('That provider account is already linked to a different OrangTask user.')
    if (linked || err) {
      searchParams.delete('linked')
      searchParams.delete('link_error')
      setSearchParams(searchParams, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const connect = (p: 'github' | 'google') => {
    haptics.tap()
    window.location.href = `/api/auth/${p}?link=1`
  }

  const disconnect = async (p: 'github' | 'google') => {
    setBusy(p)
    try {
      await api.post('/auth/unlink', { provider: p })
      haptics.tap()
      await load()
    } finally {
      setBusy('')
    }
  }

  const rows: { id: 'github' | 'google'; label: string; glyph: React.ReactNode }[] = [
    { id: 'github', label: 'GitHub', glyph: <Github size={16} /> },
    { id: 'google', label: 'Google', glyph: <GoogleGlyph /> },
  ]

  return (
    <div className="pt-4 border-t border-gray-200 dark:border-ink-700">
      <div className="flex items-center gap-2 mb-1">
        <Link2 size={16} className="text-gray-400" />
        <span className="text-sm font-medium">Connected accounts</span>
      </div>
      <p className="text-sm text-gray-500 dark:text-ink-400 mb-3">
        Sign in to this account with any of these - even if their email differs from yours.
      </p>

      {banner && (
        <div className="mb-3 px-3 py-2 text-sm bg-orange-50 dark:bg-ink-750 text-orange-700 dark:text-orange-400">
          {banner}
        </div>
      )}

      <div className="space-y-2">
        {rows.map(({ id, label, glyph }) => {
          const linked = data?.accounts.find((a) => a.provider === id)
          const configured = providers[id]
          return (
            <div key={id} className="flex items-center gap-3 surface px-3 py-2.5">
              <span className="w-4 flex justify-center">{glyph}</span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{label}</div>
                <div className="text-xs text-gray-400 truncate">
                  {linked
                    ? linked.provider_email || 'Connected'
                    : configured ? 'Not connected' : 'Not configured on this server'}
                </div>
              </div>
              {linked ? (
                <button
                  onClick={() => disconnect(id)}
                  disabled={busy === id}
                  className="btn-secondary text-sm disabled:opacity-50 inline-flex items-center"
                >
                  <Unlink size={14} className="mr-1.5" /> Disconnect
                </button>
              ) : (
                <button
                  onClick={() => connect(id)}
                  disabled={!configured}
                  className="btn-secondary text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Connect
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function NotifToggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="cursor-pointer inline-flex">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only peer" />
      <div className="w-9 h-5 bg-gray-300 dark:bg-ink-600 peer-checked:bg-orange-500 rounded-full relative transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:w-4 after:h-4 after:rounded-full after:transition-transform peer-checked:after:translate-x-4" />
    </label>
  )
}

type ChannelPrefs = Record<string, { push: boolean; email: boolean }>

const NOTIF_TYPES = [
  { key: 'task_due_soon', label: 'Task due soon', desc: '1 hour before a task is due' },
  { key: 'task_assigned', label: 'Task assigned', desc: 'When someone assigns you a task' },
  { key: 'list_shared', label: 'List shared', desc: 'When someone shares a list with you' },
  { key: 'task_completed_by', label: 'Task completed', desc: 'When a collaborator completes a shared task' },
]

function NotificationsSection() {
  const haptics = useHaptics()
  const [prefs, setPrefs] = useState<ChannelPrefs | null>(null)
  const [pushState, setPushState] = useState<PushState>('unsupported')
  const [busy, setBusy] = useState(false)
  const [testMsg, setTestMsg] = useState('')

  useEffect(() => {
    api.get<{ prefs: ChannelPrefs }>('/user/notification-prefs').then((d) => setPrefs(d.prefs)).catch(() => {})
    getPushState().then(setPushState).catch(() => {})
  }, [])

  const setChannel = (typeKey: string, channel: 'push' | 'email', value: boolean) => {
    if (!prefs) return
    haptics.tap()
    const next = { ...prefs, [typeKey]: { ...prefs[typeKey], [channel]: value } }
    setPrefs(next)
    api.put('/user/notification-prefs', { prefs: next }).catch(() => {})
  }

  const toggleDevicePush = async () => {
    if (busy) return
    setBusy(true)
    try {
      setPushState(pushState === 'subscribed' ? await disablePush() : await enablePush())
    } finally {
      setBusy(false)
    }
  }

  const sendTest = async () => {
    setTestMsg('Testing…')
    const local = await showLocalTestNotification().catch(() => false)
    let server: { subscriptions: number } | null = null
    try {
      server = await sendTestPush()
    } catch {
      server = null
    }
    setTestMsg(
      `Local: ${local ? 'shown' : 'failed'} · ` +
        `Server push: ${server ? `sent to ${server.subscriptions} device(s)` : 'failed'}`
    )
    setTimeout(() => setTestMsg(''), 12000)
  }

  return (
    <div className="max-w-lg space-y-5">
      <SectionTitle title="Notifications" />

      {/* device push enable / disable */}
      <div className="surface p-4 flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-medium">Push on this device</div>
          <div className="text-xs text-gray-400">
            {pushState === 'unsupported' && 'Not supported by this browser.'}
            {pushState === 'denied' && 'Blocked - allow notifications for this site in your browser settings.'}
            {pushState === 'subscribed' && 'This device will receive push notifications.'}
            {pushState === 'unsubscribed' && 'Turn on to receive notifications on this device.'}
          </div>
        </div>
        {pushState === 'unsupported' || pushState === 'denied' ? (
          <span className="text-xs text-gray-400 whitespace-nowrap">{pushState === 'denied' ? 'Blocked' : 'N/A'}</span>
        ) : (
          <button
            onClick={toggleDevicePush}
            disabled={busy}
            className={`${pushState === 'subscribed' ? 'btn-secondary' : 'btn-primary'} text-sm whitespace-nowrap disabled:opacity-50`}
          >
            {pushState === 'subscribed' ? 'Turn off' : 'Turn on'}
          </button>
        )}
      </div>

      {/* test push */}
      {pushState === 'subscribed' && (
        <div className="flex items-center gap-3 -mt-2">
          <button onClick={sendTest} className="btn-secondary text-sm">Send test notification</button>
          {testMsg && <span className="text-xs text-gray-400">{testMsg}</span>}
        </div>
      )}

      {/* per-type channel table */}
      <div>
        <div className="grid grid-cols-[1fr_3rem_3rem] items-center gap-x-3 px-1 pb-2 text-[11px] uppercase tracking-wider text-gray-400 font-semibold border-b border-gray-200 dark:border-ink-700">
          <span>Notify me about</span>
          <span className="text-center">Push</span>
          <span className="text-center">Email</span>
        </div>
        {prefs ? NOTIF_TYPES.map((t) => (
          <div key={t.key} className="grid grid-cols-[1fr_3rem_3rem] items-center gap-x-3 px-1 py-3 border-b border-gray-100 dark:border-ink-800">
            <div>
              <div className="text-sm font-medium">{t.label}</div>
              <div className="text-xs text-gray-400">{t.desc}</div>
            </div>
            <div className="flex justify-center">
              <NotifToggle checked={!!prefs[t.key]?.push} onChange={(v) => setChannel(t.key, 'push', v)} />
            </div>
            <div className="flex justify-center">
              <NotifToggle checked={!!prefs[t.key]?.email} onChange={(v) => setChannel(t.key, 'email', v)} />
            </div>
          </div>
        )) : (
          <div className="py-6 text-center text-sm text-gray-400">Loading…</div>
        )}
      </div>

      <p className="text-xs text-gray-400">
        Push delivers to devices where you've turned it on above. Email goes to your account address.
      </p>
    </div>
  )
}

function ApiKeysManager() {
  const { data: keys } = useApiKeys()
  const createKey = useCreateApiKey()
  const deleteKey = useDeleteApiKey()
  const haptics = useHaptics()
  const [name, setName] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [revealed, setRevealed] = useState<{ name: string; raw_key: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const handleCreate = async () => {
    if (!name.trim()) return
    const key = await createKey.mutateAsync(name.trim())
    haptics.success()
    setRevealed({ name: key.name, raw_key: key.raw_key })
    setName('')
    setShowForm(false)
  }

  const copyKey = () => {
    if (!revealed) return
    navigator.clipboard.writeText(revealed.raw_key)
    setCopied(true)
    haptics.success()
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-3">
      {revealed && (
        <div className="surface p-4 border-orange-300 dark:border-orange-800">
          <div className="text-sm font-medium mb-1">API key created: {revealed.name}</div>
          <p className="text-sm text-gray-500 dark:text-ink-400 mb-2">
            Copy it now, for your security, it won't be shown again.
          </p>
          <div className="flex gap-2">
            <code className="flex-1 text-xs bg-gray-100 dark:bg-ink-900 px-2 py-2 truncate rounded">{revealed.raw_key}</code>
            <button onClick={copyKey} className="btn-secondary px-3">
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
          </div>
          <button onClick={() => setRevealed(null)} className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-white mt-2">
            Done
          </button>
        </div>
      )}

      {keys?.map((k) => (
        <div key={k.id} className="surface p-3 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium">{k.name}</div>
            <div className="text-xs text-gray-400 font-mono">
              {k.key_prefix}… · {k.last_used_at ? `last used ${formatDueDate(k.last_used_at)}` : 'never used'}
            </div>
          </div>
          <button
            onClick={() => {
              if (confirm(`Revoke "${k.name}"? Any integration using it will stop working.`)) {
                haptics.error()
                deleteKey.mutate(k.id)
              }
            }}
            className="text-gray-400 hover:text-red-500"
            aria-label={`Revoke ${k.name}`}
          >
            <Trash2 size={15} />
          </button>
        </div>
      ))}

      {showForm ? (
        <div className="surface p-4 space-y-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder="e.g. n8n integration"
            className="input-field w-full"
          />
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={createKey.isPending} className="btn-primary flex-1">
              {createKey.isPending ? 'Creating...' : 'Create key'}
            </button>
            <button onClick={() => setShowForm(false)} className="btn-secondary px-4"><X size={16} /></button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowForm(true)} className="btn-secondary w-full">
          <Plus size={16} className="mr-2" /> New API key
        </button>
      )}
    </div>
  )
}

function IntegrationsSection() {
  const examples = [
    { name: 'n8n', desc: 'Use the HTTP Request node to POST to your incoming webhook URL, or trigger flows from outgoing events.' },
    { name: 'Zapier', desc: 'Create a "Webhooks by Zapier" action pointing at your incoming URL to push tasks from any Zapier trigger.' },
    { name: 'GitHub Actions', desc: 'Add a curl step that POSTs to your incoming webhook to create a task when a workflow runs.' },
  ]
  return (
    <div className="max-w-2xl space-y-8">
      <div className="space-y-4">
        <SectionTitle title="API keys" />
        <p className="text-sm text-gray-500 dark:text-ink-400">
          Generate a personal API key to call the full OrangTask API directly (read/write lists, tasks, tags) from
          scripts or tools that need more than the one-way incoming webhook below. Keys don't expire like a login
          session, revoke one any time it's no longer needed.
        </p>
        <ApiKeysManager />
      </div>

      <div className="space-y-4">
        <SectionTitle title="Webhooks & integrations" />
        <p className="text-sm text-gray-500 dark:text-ink-400">
          OrangTask works with any tool that can send or receive HTTP requests. Create a webhook in the Webhooks tab, then wire it up:
        </p>
        <div className="space-y-2">
          {examples.map((ex) => (
            <div key={ex.name} className="surface p-4">
              <div className="flex items-center gap-2 font-medium mb-1">
                <Plug size={16} className="text-orange-500" /> {ex.name}
              </div>
              <p className="text-sm text-gray-500 dark:text-ink-400">{ex.desc}</p>
            </div>
          ))}
        </div>
        <div className="surface p-4">
          <div className="text-xs uppercase tracking-wide text-gray-400 mb-2">Incoming webhook payload example</div>
          <pre className="text-xs bg-gray-100 dark:bg-ink-900 p-3 overflow-x-auto rounded">{`POST /api/hooks/<incoming-webhook-token>
{
  "title": "Review PR",
  "due": "tomorrow at 3pm",
  "list": "Work",
  "priority": "high",
  "tags": ["code-review"]
}`}</pre>
        </div>
        <div className="surface p-4">
          <div className="text-xs uppercase tracking-wide text-gray-400 mb-2">Direct API access example</div>
          <pre className="text-xs bg-gray-100 dark:bg-ink-900 p-3 overflow-x-auto rounded">{`GET /api/tasks
Authorization: Bearer <api-key>`}</pre>
        </div>
      </div>
    </div>
  )
}

// google Keep import The user picks the Google Takeout .zip directly; we unzip it in the browser
function KeepImport() {
  const qc = useQueryClient()
  const haptics = useHaptics()
  const [notes, setNotes] = useState<any[]>([])
  const [fileName, setFileName] = useState('')
  const [listName, setListName] = useState('Google Keep')
  const [includeArchived, setIncludeArchived] = useState(true)
  const [includeTrashed, setIncludeTrashed] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState('')
  const [error, setError] = useState('')

  const isKeepNote = (o: any) =>
    o && typeof o === 'object' &&
    (typeof o.textContent === 'string' || Array.isArray(o.listContent) ||
      typeof o.title === 'string' || typeof o.userEditedTimestampUsec === 'number')

  const onZip = async (file: File | undefined) => {
    setError('')
    setResult('')
    setNotes([])
    setFileName('')
    if (!file) return
    setParsing(true)
    try {
      const buf = new Uint8Array(await file.arrayBuffer())
      // only inflate the .json note files - skip the bundled images/HTML so a large export with attachments
      const entries = unzipSync(buf, { filter: (f) => f.name.toLowerCase().endsWith('.json') })
      const decoder = new TextDecoder()
      const parsed: any[] = []
      for (const path of Object.keys(entries)) {
        try {
          const obj = JSON.parse(decoder.decode(entries[path]))
          if (isKeepNote(obj)) parsed.push(obj)
        } catch {
          // skip non-note JSON (Takeout metadata, etc.)
        }
      }
      if (parsed.length === 0) {
        setError('No Google Keep notes found in that zip. Make sure it’s the Takeout archive that contains a “Keep” folder.')
        return
      }
      setFileName(file.name)
      setNotes(parsed)
    } catch {
      setError('Could not read that file. Select the .zip you downloaded from Google Takeout (don’t unzip it).')
    } finally {
      setParsing(false)
    }
  }

  const runImport = async () => {
    if (notes.length === 0 || busy) return
    setBusy(true)
    setError('')
    setResult('')
    try {
      const res = await api.post<{ imported: number; subtasks: number; skipped: number; list: { name: string } }>(
        '/user/import/google-keep',
        { notes, listName, includeArchived, includeTrashed }
      )
      haptics.success()
      setResult(
        `Imported ${res.imported} note${res.imported === 1 ? '' : 's'}` +
          (res.subtasks ? ` and ${res.subtasks} checklist item${res.subtasks === 1 ? '' : 's'}` : '') +
          ` into "${res.list.name}".` +
          (res.skipped ? ` Skipped ${res.skipped} archived/trashed.` : '')
      )
      setNotes([])
      setFileName('')
      qc.invalidateQueries({ queryKey: ['lists'] })
      qc.invalidateQueries({ queryKey: ['tasks'] })
      qc.invalidateQueries({ queryKey: ['tags'] })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="text-sm font-medium mb-1">Import from Google Keep</div>
      <p className="text-sm text-gray-500 dark:text-ink-400 mb-2">
        Export your notes with{' '}
        <a href="https://takeout.google.com/" target="_blank" rel="noreferrer" className="text-orange-500 hover:underline inline-flex items-center gap-0.5">
          Google Takeout <ExternalLink size={12} />
        </a>
        , then choose the <code className="text-xs">.zip</code> it gives you - no need to unzip. Checklists become subtasks and labels become tags.
      </p>

      <label className={`btn-secondary inline-flex ${parsing ? 'opacity-60 pointer-events-none' : 'cursor-pointer'}`}>
        <Upload size={16} className="mr-2" /> {parsing ? 'Reading zip…' : 'Choose Takeout .zip'}
        <input
          type="file"
          accept=".zip,application/zip"
          className="hidden"
          disabled={parsing}
          onChange={(e) => onZip(e.target.files?.[0])}
        />
      </label>

      {notes.length > 0 && (
        <div className="mt-3 space-y-3 surface p-3">
          <div className="text-sm">
            Found <strong>{notes.length}</strong> note{notes.length === 1 ? '' : 's'}
            {fileName && <span className="text-gray-400"> in {fileName}</span>} ready to import.
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide text-gray-400 mb-1 block">Import into list</label>
            <input value={listName} onChange={(e) => setListName(e.target.value)} className="input-field" placeholder="Google Keep" />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={includeArchived} onChange={(e) => setIncludeArchived(e.target.checked)} className="accent-orange-500" />
            Include archived notes
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={includeTrashed} onChange={(e) => setIncludeTrashed(e.target.checked)} className="accent-orange-500" />
            Include trashed notes
          </label>
          <button onClick={runImport} disabled={busy} className="btn-primary disabled:opacity-50">
            {busy ? 'Importing…' : `Import ${notes.length} note${notes.length === 1 ? '' : 's'}`}
          </button>
        </div>
      )}

      {result && <p className="mt-2 text-sm text-green-600 dark:text-green-400">{result}</p>}
      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
    </div>
  )
}

function DataSection({ user, logout }: { user: any; logout: () => void }) {
  const navigate = useNavigate()
  const haptics = useHaptics()
  const [confirmEmail, setConfirmEmail] = useState('')
  const [showDelete, setShowDelete] = useState(false)

  const exportData = () => {
    haptics.tap()
    window.location.href = '/api/user/export'
  }

  const deleteAccount = async () => {
    if (confirmEmail.toLowerCase() !== user?.email?.toLowerCase()) return
    haptics.error()
    await api.delete('/user', { email: confirmEmail })
    await logout()
    navigate('/login')
  }

  return (
    <div className="max-w-md space-y-6">
      <SectionTitle title="Data" />

      <div>
        <div className="text-sm font-medium mb-1">Export your data</div>
        <p className="text-sm text-gray-500 dark:text-ink-400 mb-2">Download all your lists, tasks, tags, and webhooks as JSON.</p>
        <button onClick={exportData} className="btn-secondary">
          <Download size={16} className="mr-2" /> Export JSON
        </button>
      </div>

      <div className="pt-6 border-t border-gray-200 dark:border-ink-700">
        <KeepImport />
      </div>

      <div className="pt-6 border-t border-gray-200 dark:border-ink-700">
        <div className="text-sm font-medium text-red-500 mb-1">Delete account</div>
        <p className="text-sm text-gray-500 dark:text-ink-400 mb-2">
          Permanently delete your account and all data. This cannot be undone.
        </p>
        {showDelete ? (
          <div className="space-y-2">
            <p className="text-sm">Type <strong>{user?.email}</strong> to confirm:</p>
            <input
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              placeholder={user?.email}
              className="input-field"
            />
            <div className="flex gap-2">
              <button
                onClick={deleteAccount}
                disabled={confirmEmail.toLowerCase() !== user?.email?.toLowerCase()}
                className="btn-brand bg-red-500 text-white px-4 h-11 disabled:opacity-40"
              >
                <Trash2 size={16} className="mr-2" /> Delete forever
              </button>
              <button onClick={() => setShowDelete(false)} className="btn-secondary px-4">Cancel</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowDelete(true)} className="btn-brand bg-red-500 text-white px-4 h-11">
            <Trash2 size={16} className="mr-2" /> Delete account
          </button>
        )}
      </div>
    </div>
  )
}

function LegalSection() {
  const navigate = useNavigate()
  return (
    <div className="max-w-md space-y-4">
      <SectionTitle title="Legal" />
      <div className="space-y-3">
        <button
          onClick={() => navigate('/legal')}
          className="w-full text-left surface p-4 hover:bg-gray-50 dark:hover:bg-ink-750 transition-colors flex items-center justify-between"
        >
          <div>
            <div className="text-sm font-medium">Terms of Service</div>
            <div className="text-xs text-gray-400">Our usage rules and guidelines</div>
          </div>
          <ExternalLink size={16} className="text-gray-400" />
        </button>
        <a
          href="https://discord.gg/cpkfnRuRv7"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full text-left surface p-4 hover:bg-gray-50 dark:hover:bg-ink-750 transition-colors flex items-center justify-between"
        >
          <div>
            <div className="text-sm font-medium">Discord Community</div>
            <div className="text-xs text-gray-400">Get help and connect with others</div>
          </div>
          <ExternalLink size={16} className="text-gray-400" />
        </a>
      </div>
    </div>
  )
}
