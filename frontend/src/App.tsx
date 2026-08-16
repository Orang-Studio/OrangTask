import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Layout } from './components/Layout'
import { LoginPage } from './pages/LoginPage'
import { PinPage } from './pages/PinPage'
import { MagicPage } from './pages/MagicPage'
import { TodayPage, UpcomingPage, OverduePage, AllTasksPage, AssignedPage } from './pages/SmartViews'
import { ListPage } from './pages/ListPage'
import { ListsPage } from './pages/ListsPage'
import { ScratchpadsPage } from './pages/ScratchpadsPage'
import { SettingsPage } from './pages/SettingsPage'
import { NotificationsPage } from './pages/NotificationsPage'
import { LegalPage } from './pages/LegalPage'
import { useAuthStore } from './stores/auth'
import { useTheme } from './hooks/useTheme'
import { useLangStore, resolveLanguage, applyLanguage } from './lib/i18n'
import { Logo } from './components/Logo'
import { UndoableTaskDeleteProvider } from './components/UndoableTaskDelete'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

function LanguageGate({ children }: { children: React.ReactNode }) {
  const pref = useLangStore((s) => s.pref)
  applyLanguage(resolveLanguage(pref))
  return <>{children}</>
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading, requiresPin } = useAuthStore()

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-gray-50 dark:bg-ink-900">
        <Logo size={48} />
        <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  if (requiresPin) return <Navigate to="/pin" replace />

  return <>{children}</>
}

function AppRoutes() {
  const { fetchMe } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    fetchMe()
  }, [])

  useEffect(() => {
    const handler = () => {
      useAuthStore.getState().setUser(null)
      navigate('/login')
    }
    window.addEventListener('auth:expired', handler)
    return () => window.removeEventListener('auth:expired', handler)
  }, [navigate])

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/pin" element={<PinPage />} />
      <Route path="/auth/magic" element={<MagicPage />} />
      <Route path="/legal" element={<LegalPage />} />

      <Route
        element={
          <AuthGate>
            <UndoableTaskDeleteProvider>
              <Layout />
            </UndoableTaskDeleteProvider>
          </AuthGate>
        }
      >
        <Route path="/" element={<Navigate to="/today" replace />} />
        <Route path="/today" element={<TodayPage />} />
        <Route path="/upcoming" element={<UpcomingPage />} />
        <Route path="/overdue" element={<OverduePage />} />
        <Route path="/assigned" element={<AssignedPage />} />
        <Route path="/all" element={<AllTasksPage />} />
        <Route path="/lists" element={<ListsPage />} />
        <Route path="/scratchpads" element={<ScratchpadsPage />} />
        <Route path="/list/:id" element={<ListPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/today" replace />} />
    </Routes>
  )
}

export default function App() {
  useTheme()

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <LanguageGate>
          <AppRoutes />
        </LanguageGate>
      </BrowserRouter>
    </QueryClientProvider>
  )
}