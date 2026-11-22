import { Logo } from '../components/Logo'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Mail, Trash2 } from 'lucide-react'
import { useAuthStore } from '../stores/auth'
import { t, tNodes, type MessageKey } from '../lib/i18n'

const CONTACT = 'legal@oranges.lt'

export function DeleteAccountPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const mailto = `mailto:${CONTACT}?subject=${encodeURIComponent(
    t('deleteAccount.mailSubject' as MessageKey),
  )}`

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-ink-900 px-4 py-10">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => navigate(user ? '/today' : '/login')}
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            <ArrowLeft size={14} /> {t('common.back')}
          </button>
          <Logo size={32} />
          <h1 className="text-xl font-bold uppercase tracking-wider">
            {t('deleteAccount.title' as MessageKey)}
          </h1>
        </div>

        <div className="surface p-8 space-y-10 text-sm leading-relaxed text-gray-700 dark:text-ink-300">
          <section>
            <p>{t('deleteAccount.intro' as MessageKey)}</p>
          </section>

          <section>
            <h2 className="text-base font-bold uppercase tracking-wider text-gray-900 dark:text-white mb-4 border-b border-gray-200 dark:border-ink-600 pb-2">
              {t('deleteAccount.howTo' as MessageKey)}
            </h2>
            {user ? (
              <>
                <p className="mb-4">{t('deleteAccount.signedInStep' as MessageKey)}</p>
                <button
                  onClick={() => navigate('/settings?section=data')}
                  className="btn-brand bg-red-500 text-white px-4 h-11"
                >
                  <Trash2 size={16} className="mr-2" />
                  {t('deleteAccount.goToSettings' as MessageKey)}
                </button>
              </>
            ) : (
              <>
                <p className="mb-4">{t('deleteAccount.signedOutStep' as MessageKey)}</p>
                <button onClick={() => navigate('/login')} className="btn-brand px-4 h-11">
                  {t('deleteAccount.signIn' as MessageKey)}
                </button>
              </>
            )}
          </section>

          <section>
            <h2 className="text-base font-bold uppercase tracking-wider text-gray-900 dark:text-white mb-4 border-b border-gray-200 dark:border-ink-600 pb-2">
              {t('deleteAccount.whatIsDeleted' as MessageKey)}
            </h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>{t('deleteAccount.deletedProfile' as MessageKey)}</li>
              <li>{t('deleteAccount.deletedContent' as MessageKey)}</li>
              <li>{t('deleteAccount.deletedIntegrations' as MessageKey)}</li>
              <li>{t('deleteAccount.deletedDevices' as MessageKey)}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold uppercase tracking-wider text-gray-900 dark:text-white mb-4 border-b border-gray-200 dark:border-ink-600 pb-2">
              {t('deleteAccount.whatIsKept' as MessageKey)}
            </h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>{t('deleteAccount.keptShared' as MessageKey)}</li>
              <li>{t('deleteAccount.keptLogs' as MessageKey)}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold uppercase tracking-wider text-gray-900 dark:text-white mb-4 border-b border-gray-200 dark:border-ink-600 pb-2">
              {t('deleteAccount.cannotSignIn' as MessageKey)}
            </h2>
            <p className="mb-4">
              {tNodes('deleteAccount.cannotSignInParagraph' as MessageKey, {
                email: (
                  <a href={`mailto:${CONTACT}`} className="text-orange-500 hover:underline">
                    {CONTACT}
                  </a>
                ),
              })}
            </p>
            <a href={mailto} className="btn-secondary inline-flex items-center gap-2">
              <Mail size={16} />
              {t('deleteAccount.requestByEmail' as MessageKey)}
            </a>
          </section>

          <p className="text-xs text-gray-400 border-t border-gray-200 dark:border-ink-600 pt-6">
            {tNodes('deleteAccount.exportFirst' as MessageKey, {
              settings: (
                <a href="/settings?section=data" className="text-orange-500 hover:underline">
                  {t('settings.data' as MessageKey)}
                </a>
              ),
            })}
          </p>
        </div>
      </div>
    </div>
  )
}
