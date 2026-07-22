/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { NetworkFirst } from 'workbox-strategies'

declare let self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: (string | { url: string; revision: string | null })[]
}

// precache the app shell (manifest injected by vite-plugin-pwa at build time)
precacheAndRoute(self.__WB_MANIFEST)

self.addEventListener('install', () => {
  self.skipWaiting()
})
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

// API + navigation: network-first with a short timeout so the app works offline
registerRoute(
  ({ url }) => /\/api\/(tasks|lists|tags|notifications)/.test(url.pathname),
  new NetworkFirst({ cacheName: 'api-cache', networkTimeoutSeconds: 3 })
)
registerRoute(
  ({ request, url }) =>
    request.mode === 'navigate' && !url.pathname.startsWith('/api') && !url.pathname.startsWith('/ws'),
  new NetworkFirst({ cacheName: 'pages-cache', networkTimeoutSeconds: 3 })
)

self.addEventListener('push', (event) => {
  let data: { title?: string; body?: string; url?: string } = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { title: event.data?.text() }
  }
  const title = data.title || 'OrangTask'
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: data.url || '/' },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(
    (async () => {
      const clientsArr = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of clientsArr) {
        if ('focus' in client) {
          client.navigate(target).catch(() => {})
          return client.focus()
        }
      }
      return self.clients.openWindow(target)
    })()
  )
})
