import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Logo } from '../components/Logo'

// the backend magic-link verify endpoint sets cookies and redirects here only in edge cases; normally
export function MagicPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  useEffect(() => {
    const token = searchParams.get('token')
    if (token) {
      window.location.href = `/api/auth/magic-link/verify?token=${token}`
    } else {
      navigate('/login?error=invalid')
    }
  }, [searchParams, navigate])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <Logo size={48} />
      <p className="text-sm text-gray-400">Signing you in...</p>
    </div>
  )
}
