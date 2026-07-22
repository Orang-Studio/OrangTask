import { api } from './api'

export type PushState = 'unsupported' | 'denied' | 'subscribed' | 'unsubscribed'

export function pushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

export async function getPushState(): Promise<PushState> {
  if (!pushSupported()) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  return sub ? 'subscribed' : 'unsubscribed'
}

export async function enablePush(): Promise<PushState> {
  if (!pushSupported()) return 'unsupported'
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') return perm === 'denied' ? 'denied' : 'unsubscribed'

  const { key } = await api.get<{ key: string }>('/push/public-key')
  if (!key) return 'unsubscribed'

  const reg = await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
    })
  }
  await api.post('/push/subscribe', sub.toJSON())
  return 'subscribed'
}

export async function sendTestPush(): Promise<{ ok: boolean; configured: boolean; subscriptions: number }> {
  return api.post('/push/test')
}

// show a notification straight from the page via the SW - no push network involved
export async function showLocalTestNotification(): Promise<boolean> {
  if (!pushSupported() || Notification.permission !== 'granted') return false
  const reg = await navigator.serviceWorker.ready
  await reg.showNotification('OrangTask - local test', {
    body: 'If you can see this, notifications display correctly on this device.',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: 'orangtask-local-test',
    data: { url: '/today' },
  })
  return true
}

export async function disablePush(): Promise<PushState> {
  if (!pushSupported()) return 'unsupported'
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  if (sub) {
    await api.post('/push/unsubscribe', { endpoint: sub.endpoint }).catch(() => {})
    await sub.unsubscribe().catch(() => {})
  }
  return 'unsubscribed'
}
