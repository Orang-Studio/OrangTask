import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { modKey } from '../lib/platform'
import { t, type MessageKey } from '../lib/i18n'

export function ShortcutsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const SHORTCUTS = [
    { keys: ['N'], desc: t('shortcuts.newTask' as MessageKey) },
    { keys: ['/'], desc: t('shortcuts.focusSearch' as MessageKey) },
    { keys: [modKey, 'K'], desc: t('shortcuts.commandPalette' as MessageKey) },
    { keys: ['?'], desc: t('shortcuts.showHelp' as MessageKey) },
    { keys: ['Space'], desc: t('shortcuts.toggleComplete' as MessageKey) },
    { keys: ['Enter'], desc: t('shortcuts.openTask' as MessageKey) },
    { keys: ['P'], desc: t('shortcuts.cyclePriority' as MessageKey) },
    { keys: ['D'], desc: t('shortcuts.setDueDate' as MessageKey) },
    { keys: ['Del'], desc: t('shortcuts.deleteTask' as MessageKey) },
    { keys: ['Esc'], desc: t('shortcuts.closeDeselect' as MessageKey) },
  ]

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="w-full max-w-md bg-white dark:bg-ink-850 border border-gray-200 dark:border-ink-600 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-ink-700">
              <h2 className="font-bold uppercase tracking-wide">{t('shortcuts.title' as MessageKey)}</h2>
              <button onClick={onClose} aria-label={t('common.close')} className="text-gray-400 hover:text-gray-600 dark:hover:text-white">
                <X size={20} />
              </button>
            </div>
            <div className="p-5 space-y-2">
              {SHORTCUTS.map((s) => (
                <div key={s.desc} className="flex items-center justify-between py-1">
                  <span className="text-sm text-gray-600 dark:text-ink-300">{s.desc}</span>
                  <div className="flex gap-1">
                    {s.keys.map((k) => (
                      <kbd
                        key={k}
                        className="px-2 py-1 text-xs font-mono bg-gray-100 dark:bg-ink-700 border border-gray-300 dark:border-ink-500 rounded"
                      >
                        {k}
                      </kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
