import { Logo } from '../components/Logo'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useAuthStore } from '../stores/auth'

export function LegalPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-ink-900 px-4 py-10">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => navigate(user ? '/today' : '/login')}
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            <ArrowLeft size={14} /> Back
          </button>
          <Logo size={32} />
          <h1 className="text-xl font-bold uppercase tracking-wider">Legal</h1>
        </div>

        <div className="surface p-8 space-y-10 text-sm leading-relaxed text-gray-700 dark:text-ink-300">

          {/* terms */}
          <section>
            <h2 className="text-base font-bold uppercase tracking-wider text-gray-900 dark:text-white mb-4 border-b border-gray-200 dark:border-ink-600 pb-2">
              Terms of Service
            </h2>
            <p className="mb-3">Last updated: June 18, 2026</p>

            <p className="mb-3">
              OrangTask ("the Service") is operated by Orange Studio. By creating an account or using the
              Service you agree to these terms. If you do not agree, do not use the Service.
            </p>

            <h3 className="font-semibold text-gray-900 dark:text-white mt-5 mb-2">Use of the Service</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>You must be at least 16 years old to use OrangTask.</li>
              <li>You are responsible for keeping your account credentials secure.</li>
              <li>You may not use the Service for any unlawful purpose or to harm others.</li>
              <li>We reserve the right to suspend or terminate accounts that violate these terms.</li>
            </ul>

            <h3 className="font-semibold text-gray-900 dark:text-white mt-5 mb-2">Your Content</h3>
            <p className="mb-3">
              You retain ownership of tasks, notes, and other content you create. By using the Service you
              grant us a limited licence to store and process that content solely to provide the Service.
              We do not sell your content.
            </p>

            <h3 className="font-semibold text-gray-900 dark:text-white mt-5 mb-2">Service Availability</h3>
            <p className="mb-3">
              The Service is provided "as is" without warranties of any kind. We may modify, suspend, or
              discontinue the Service at any time. We are not liable for any loss of data or downtime.
            </p>

            <h3 className="font-semibold text-gray-900 dark:text-white mt-5 mb-2">Limitation of Liability</h3>
            <p>
              To the maximum extent permitted by applicable law, Orange Studio shall not be liable for any
              indirect, incidental, special, or consequential damages arising from your use of the Service.
              Our total liability to you shall not exceed the amount you paid us in the 12 months preceding
              the claim (which for a free service is €0).
            </p>
          </section>

          {/* privacy */}
          <section>
            <h2 className="text-base font-bold uppercase tracking-wider text-gray-900 dark:text-white mb-4 border-b border-gray-200 dark:border-ink-600 pb-2">
              Privacy Policy
            </h2>
            <p className="mb-3">Last updated: June 18, 2026</p>

            <h3 className="font-semibold text-gray-900 dark:text-white mt-5 mb-2">What we collect</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Account data</strong>: email address, optional display name.</li>
              <li><strong>Task data</strong>: tasks, lists, tags, due dates, and notes you create.</li>
              <li><strong>Usage data</strong>: server logs (IP address, timestamp, HTTP method/path) retained for up to 30 days for security and debugging.</li>
              <li><strong>Push notification tokens</strong>: stored only if you opt in to push notifications.</li>
            </ul>

            <h3 className="font-semibold text-gray-900 dark:text-white mt-5 mb-2">How we use it</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>To provide and operate the Service.</li>
              <li>To send transactional emails (magic-link sign-in, password reset, task reminders) that you explicitly request.</li>
              <li>To send push notifications you have opted in to.</li>
              <li>We do not use your data for advertising or sell it to third parties.</li>
            </ul>

            <h3 className="font-semibold text-gray-900 dark:text-white mt-5 mb-2">Data storage & security</h3>
            <p className="mb-3">
              All data is stored on servers located in the EU. Passwords are hashed with bcrypt and never
              stored in plaintext. Connections are encrypted via TLS.
            </p>

            <h3 className="font-semibold text-gray-900 dark:text-white mt-5 mb-2">Third-party services</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>GitHub / Google OAuth</strong>: if you sign in via OAuth, we receive your email and public profile from that provider.</li>
              <li><strong>Email delivery</strong>: transactional emails are sent via a third-party SMTP provider.</li>
            </ul>

            <h3 className="font-semibold text-gray-900 dark:text-white mt-5 mb-2">Your rights (GDPR)</h3>
            <p className="mb-3">
              If you are in the EU/EEA you have the right to access, correct, export, or delete your
              personal data. You can delete your account and all associated data from the Settings page.
              For other requests, email us at <a href="mailto:legal@oranges.lt" className="text-orange-500 hover:underline">legal@oranges.lt</a>.
            </p>

            <h3 className="font-semibold text-gray-900 dark:text-white mt-5 mb-2">Cookies</h3>
            <p>
              We use a single HTTP-only cookie to maintain your session. No tracking or advertising cookies
              are used.
            </p>
          </section>

          <p className="text-xs text-gray-400 border-t border-gray-200 dark:border-ink-600 pt-6">
            Questions? Contact <a href="mailto:legal@oranges.lt" className="text-orange-500 hover:underline">legal@oranges.lt</a> or join our <a href="https://discord.gg/cpkfnRuRv7" target="_blank" rel="noopener noreferrer" className="text-orange-500 hover:underline">Discord community</a>
          </p>
        </div>
      </div>
    </div>
  )
}
