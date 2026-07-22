import { useEffect, useRef, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'

// native WebSocket client with auto-reconnect (exponential backoff)
export function useWebSocket(enabled: boolean) {
  const queryClient = useQueryClient()
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectAttempts = useRef(0)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pingTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const shouldConnect = useRef(enabled)

  const connect = useCallback(() => {
    if (!shouldConnect.current) return
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const ws = new WebSocket(`${proto}://${window.location.host}/ws`)
    wsRef.current = ws

    ws.onopen = () => {
      reconnectAttempts.current = 0
      pingTimer.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }))
        }
      }, 25000)
    }

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        switch (msg.type) {
          case 'task.created':
          case 'task.updated':
          case 'task.deleted':
            queryClient.invalidateQueries({ queryKey: ['tasks'] })
            queryClient.invalidateQueries({ queryKey: ['lists'] })
            break
          case 'list.updated':
          case 'list.deleted':
            queryClient.invalidateQueries({ queryKey: ['lists'] })
            break
          case 'notification.new':
            queryClient.invalidateQueries({ queryKey: ['notifications'] })
            break
        }
      } catch {}
    }

    ws.onclose = () => {
      if (pingTimer.current) clearInterval(pingTimer.current)
      if (!shouldConnect.current) return
      // exponential backoff: 1s, 2s, 4s, 8s .. capped at 30s
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000)
      reconnectAttempts.current++
      reconnectTimer.current = setTimeout(connect, delay)
    }

    ws.onerror = () => {
      ws.close()
    }
  }, [queryClient])

  useEffect(() => {
    shouldConnect.current = enabled
    if (enabled) {
      connect()
    }
    return () => {
      shouldConnect.current = false
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
      if (pingTimer.current) clearInterval(pingTimer.current)
      wsRef.current?.close()
    }
  }, [enabled, connect])
}
