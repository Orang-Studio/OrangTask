import { create } from 'zustand'
import { api, User } from '../lib/api'

interface AuthState {
  user: User | null
  loading: boolean
  requiresPin: boolean
  setUser: (u: User | null) => void
  setRequiresPin: (v: boolean) => void
  fetchMe: () => Promise<void>
  logout: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  requiresPin: false,

  setUser: (user) => set({ user }),
  setRequiresPin: (requiresPin) => set({ requiresPin }),

  fetchMe: async () => {
    set({ loading: true })
    try {
      // the server decides if a PIN is still required
      const res = await api.get<{ user: User; requires_pin?: boolean }>('/auth/me')
      set({ user: res.user, loading: false, requiresPin: !!res.requires_pin })
    } catch {
      set({ user: null, loading: false, requiresPin: false })
    }
  },

  logout: async () => {
    try {
      await api.post('/auth/logout')
    } catch {}
    set({ user: null, requiresPin: false })
  },
}))
