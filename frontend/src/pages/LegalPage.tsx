import { Logo } from '../components/Logo'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useAuthStore } from '../stores/auth'
import { t, tNodes, type MessageKey } from '../lib/i18n'

export function LegalPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const updated = 'June 18, 2026'

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
          <h1 className="text-xl font-bold uppercase tracking-wider">{t('legal.title' as MessageKey)}</h1>
        </div>

        <div className="surface p-8 space-y-10 text-sm leading-relaxed text-gray-700 dark:text-ink-300">

          <section>
            <h2 className="text-base font-bold uppercase tracking-wider text-gray-900 dark:text-white mb-4 border-b border-gray-200 dark:border-ink-600 pb-2">
              {t('legal.termsTitle' as MessageKey)}
            </h2>
            <p className="mb-3">{t('legal.lastUpdated' as MessageKey, { date: updated })}</p>

            <p className="mb-3">
              {t('legal.operatedBy' as MessageKey)}
            </p>

            <h3 className="font-semibold text-gray-900 dark:text-white mt-5 mb-2">{t('legal.useOfService' as MessageKey)}</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>{t('legal.termAge' as MessageKey)}</li>
              <li>{t('legal.termCredentials' as MessageKey)}</li>
              <li>{t('legal.termUnlawful' as MessageKey)}</li>
              <li>{t('legal.termSuspension' as MessageKey)}</li>
            </ul>

            <h3 className="font-semibold text-gray-900 dark:text-white mt-5 mb-2">{t('legal.yourContent' as MessageKey)}</h3>
            <p className="mb-3">
              {t('legal.contentParagraph' as MessageKey)}
            </p>

            <h3 className="font-semibold text-gray-900 dark:text-white mt-5 mb-2">{t('legal.serviceAvailability' as MessageKey)}</h3>
            <p className="mb-3">
              {t('legal.availabilityParagraph' as MessageKey)}
            </p>

            <h3 className="font-semibold text-gray-900 dark:text-white mt-5 mb-2">{t('legal.limitationOfLiability' as MessageKey)}</h3>
            <p>
              {t('legal.liabilityParagraph' as MessageKey)}
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold uppercase tracking-wider text-gray-900 dark:text-white mb-4 border-b border-gray-200 dark:border-ink-600 pb-2">
              {t('legal.privacyPolicy' as MessageKey)}
            </h2>
            <p className="mb-3">{t('legal.lastUpdated' as MessageKey, { date: updated })}</p>

            <h3 className="font-semibold text-gray-900 dark:text-white mt-5 mb-2">{t('legal.whatWeCollect' as MessageKey)}</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>{tNodes('legal.collectAccount' as MessageKey, { account: <strong>{t('legal.accountData' as MessageKey)}</strong> })}</li>
              <li>{tNodes('legal.collectTask' as MessageKey, { task: <strong>{t('legal.taskData' as MessageKey)}</strong> })}</li>
              <li>{tNodes('legal.collectUsage' as MessageKey, { usage: <strong>{t('legal.usageData' as MessageKey)}</strong> })}</li>
              <li>{tNodes('legal.collectPush' as MessageKey, { push: <strong>{t('legal.pushTokens' as MessageKey)}</strong> })}</li>
            </ul>

            <h3 className="font-semibold text-gray-900 dark:text-white mt-5 mb-2">{t('legal.howWeUse' as MessageKey)}</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>{t('legal.useProvide' as MessageKey)}</li>
              <li>{t('legal.useTransactional' as MessageKey)}</li>
              <li>{t('legal.usePush' as MessageKey)}</li>
              <li>{t('legal.useNoAds' as MessageKey)}</li>
            </ul>

            <h3 className="font-semibold text-gray-900 dark:text-white mt-5 mb-2">{t('legal.dataStorage' as MessageKey)}</h3>
            <p className="mb-3">
              {t('legal.storageParagraph' as MessageKey)}
            </p>

            <h3 className="font-semibold text-gray-900 dark:text-white mt-5 mb-2">{t('legal.thirdParty' as MessageKey)}</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>{tNodes('legal.oauthItem' as MessageKey, { oauth: <strong>{t('legal.oauth' as MessageKey)}</strong> })}</li>
              <li>{tNodes('legal.emailDeliveryItem' as MessageKey, { emailDelivery: <strong>{t('legal.emailDelivery' as MessageKey)}</strong> })}</li>
            </ul>

            <h3 className="font-semibold text-gray-900 dark:text-white mt-5 mb-2">{t('legal.gdprRights' as MessageKey)}</h3>
            <p className="mb-3">
              {tNodes('legal.gdprParagraph' as MessageKey, { email: <a href="mailto:legal@oranges.lt" className="text-orange-500 hover:underline">legal@oranges.lt</a> })}
            </p>

            <h3 className="font-semibold text-gray-900 dark:text-white mt-5 mb-2">{t('legal.cookies' as MessageKey)}</h3>
            <p>
              {t('legal.cookiesParagraph' as MessageKey)}
            </p>
          </section>

          <p className="text-xs text-gray-400 border-t border-gray-200 dark:border-ink-600 pt-6">
            {tNodes('legal.contactFooter' as MessageKey, {
              email: <a href="mailto:legal@oranges.lt" className="text-orange-500 hover:underline">legal@oranges.lt</a>,
              discord: <a href="https://discord.gg/cpkfnRuRv7" target="_blank" rel="noopener noreferrer" className="text-orange-500 hover:underline">{t('legal.discordCommunity' as MessageKey)}</a>,
            })}
          </p>
        </div>
      </div>
    </div>
  )
}
