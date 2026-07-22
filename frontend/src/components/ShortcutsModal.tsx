import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { modKey } from '../lib/platform'

const SHORTCUTS = [
  { keys: ['N'], desc: 'New task' },
  { keys: ['/'], desc: 'Focus search' },
  { keys: [modKey, 'K'], desc: 'Command palette' },
  { keys: ['?'], desc: 'Show this help' },
  { keys: ['Space'], desc: 'Toggle complete (task focused)' },
  { keys: ['Enter'], desc: 'Open task detail' },
  { keys: ['P'], desc: 'Cycle priority' },
  { keys: ['D'], desc: 'Set due date' },
  { keys: ['Del'], desc: 'Delete task' },
  { keys: ['Esc'], desc: 'Close / deselect' },
]

export function ShortcutsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
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
              <h2 className="font-bold uppercase tracking-wide">Keyboard Shortcuts</h2>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-white">
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
